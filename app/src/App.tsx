import AppRoutes from "./routes/AppRoutes";
import ChatbotWidget from "./components/chatbot/ChatbotWidget";

function App() {
  return (
    <>
      <AppRoutes />
      {/* <ChatbotWidget /> */}

      <div className="chatbot-widget fixed bottom-4 left-4 z-50">
  <span className="brand-img fixed bottom-38 left-4 w-42 flex text-xs gap-2 items-center"> Powered by 
<a href="https://elevenlabs.io/agents" target="_blank"><img  src="https://11labs-nonprd-15f22c1d.s3.eu-west-3.amazonaws.com/0b9cd3e1-9fad-4a5b-b3a0-c96b0a1f1d2b/elevenlabs-logo-black.svg" alt="CCA Chatbot" style={{ width: 'auto', height: '10px', cursor: 'pointer' }}    /></a>
</span>
</div>
      <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
      {/* @ts-ignore */}
      <elevenlabs-convai agent-id="agent_8601kfmaszkkepbv9nfwqm99814v"></elevenlabs-convai>
    </>
  );
}

export default App;