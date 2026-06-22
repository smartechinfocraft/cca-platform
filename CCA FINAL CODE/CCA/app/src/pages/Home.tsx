import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Achievements from "../components/Achievements";
import ProgramsOverview from "../components/ProgramsOverview";
import WhyChooseCCA from "../components/WhyChooseCCA";
import Locations from "../components/Locations";
import Franchises from "../components/Franchises";
import Sponsors from "../components/Sponsors";
import CTA from "../components/CTA";
import Footer from "../components/Footer";

function Home() {
  return (
    <div className="overflow-x-hidden">
      <Navbar />
      <Hero />
      <Achievements />
      <ProgramsOverview />
      <WhyChooseCCA />
      <Locations />
      <Franchises />
      <Sponsors />
      <CTA />
      <Footer />
    </div>
  );
}

export default Home;