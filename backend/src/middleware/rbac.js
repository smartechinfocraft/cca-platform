// ============================================================
//  middleware/rbac.js
//  Formal Role-Based Access Control (RBAC) layer.
//
//  AUTHORIZATION MODEL FOR THIS APP (read this before adding routes)
//  ────────────────────────────────────────────────────────────────
//  There are THREE separate identity types, each with its own auth
//  middleware and its own JWT `type` claim so tokens can never cross
//  portals:
//
//    1. Admin   (middleware/auth.js → protect)      type: 'admin'
//       Roles:  ADMIN, SUPER_ADMIN
//       Scope:  Global — admins operate on ALL academy resources.
//               No per-record ownership check is needed for admins;
//               instead, ROLE decides what an admin may do
//               (e.g. only SUPER_ADMIN may create other admins,
//               delete permanently, or edit a confirmed registration).
//
//    2. Coach   (middleware/coachAuth.js → coachAuth) type: 'coach'
//       Roles:  none (single role) — but OBJECT-LEVEL authorization
//               is critical: a coach may only ever see/act on
//               batches, students, and attendance that belong to
//               batches/programs THEY are assigned to. Every
//               coach-portal controller must re-derive "my batches"
//               from the DB (req.coach._id) and check any :id or
//               query param against that set — never trust an id
//               from the client as automatically "theirs".
//
//    3. Parent  (routes/public_registration.js → parentAuth)  type: 'parent'
//       Roles:  none (single role) — OBJECT-LEVEL authorization is
//               critical here too: a parent may only ever read/write
//               their OWN registrations, students, and messages
//               (filtered by `parentId: req.parent.id` on every
//               query — never by a client-supplied parentId).
//
//  This file provides the reusable, generic ROLE-gating primitive
//  (`requireRole`) that the admin portal's role checks are built on,
//  plus a small `requireOwner` helper for object-level checks that
//  follow a simple "load doc, compare owner field" shape.
// ============================================================

// ─── requireRole ────────────────────────────────────────────────────────────
// Generic role gate. Must run AFTER an identity middleware (protect /
// coachAuth / parentAuth) has already set req.user / req.coach / req.parent.
// `getRole` extracts the role string to check from the request.
//
// Returns 403 (Forbidden) — the caller IS authenticated, they just don't
// have the required role. A missing/invalid token is always a 401 and is
// handled by the identity middleware that runs before this one.
const requireRole = (allowedRoles, getRole = (req) => req.user?.role) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    const role = getRole(req);
    if (!role) {
      // Identity middleware didn't run or didn't attach a role — treat as
      // unauthenticated rather than silently allowing through.
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied — requires role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

// ─── requireOwner ───────────────────────────────────────────────────────────
// Generic object-level authorization factory for the simple case: load a
// document by req.params[idParam], compare its `ownerField` against the
// current identity's id, 404 if missing, 403 if it belongs to someone else.
//
// Usage:
//   router.get('/students/:id', parentAuth,
//     requireOwner({ model: 'Student', idParam: 'id', ownerField: 'parentId', getIdentityId: (req) => req.parent.id }),
//     controllerFn);
//
// The middleware attaches the loaded document to req.ownedDoc so the
// controller doesn't have to look it up a second time.
const requireOwner = ({ model, idParam = 'id', ownerField, getIdentityId }) => {
  return async (req, res, next) => {
    try {
      const mongoose = require('mongoose');
      const Model = mongoose.model(model);
      const doc = await Model.findById(req.params[idParam]);

      if (!doc) {
        return res.status(404).json({ success: false, message: `${model} not found` });
      }

      const ownerId = doc[ownerField]?.toString?.() ?? String(doc[ownerField]);
      const identityId = String(getIdentityId(req));

      if (ownerId !== identityId) {
        return res.status(403).json({ success: false, message: 'You do not have access to this resource' });
      }

      req.ownedDoc = doc;
      next();
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
};

module.exports = { requireRole, requireOwner };
