import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ProjectWorkspace from "@/pages/ProjectWorkspace";
import Characters from "@/pages/Characters";
import CharacterDetail from "@/pages/CharacterDetail";
import Worldbuilding from "@/pages/Worldbuilding";
import AIAssistant from "@/pages/AIAssistant";
import ChapterEditor from "@/pages/ChapterEditor";
import OutlineEditor from "@/pages/OutlineEditor";
import StarChart from "@/pages/StarChart";
import Timeline from "@/pages/Timeline";
import MediaAssets from "@/pages/MediaAssets";
import Settings from "@/pages/Settings";
import ToastContainer from "@/components/ui/Toast";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectWorkspace />} />
          <Route path="/projects/:id/characters" element={<Characters />} />
          <Route path="/projects/:id/characters/:charId" element={<CharacterDetail />} />
          <Route path="/projects/:id/worldbuilding" element={<Worldbuilding />} />
          <Route path="/projects/:id/ai-assistant" element={<AIAssistant />} />
          <Route path="/projects/:id/chapters" element={<ChapterEditor />} />
          <Route path="/projects/:id/outlines" element={<OutlineEditor />} />
          <Route path="/projects/:id/starchart" element={<StarChart />} />
          <Route path="/projects/:id/timeline" element={<Timeline />} />
          <Route path="/projects/:id/media" element={<MediaAssets />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      <ToastContainer />
    </Router>
  );
}