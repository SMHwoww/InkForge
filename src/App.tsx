import { useEffect, useState } from 'react';
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
import Settings from "@/pages/Settings";
import ToastContainer from "@/components/ui/Toast";
import { UpdateDialog } from "@/components/UpdateDialog";
import { checkForUpdates, type UpdateInfo } from "@/lib/updateChecker";
import { getBaseUrl } from "@/lib/tauri-env";

export default function App() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const base = await getBaseUrl();
        const configUrl = base ? `${base}/api/config/update` : '/api/config/update';
        const res = await fetch(configUrl);
        const json = await res.json();
        if (json.code !== 0 || !json.data?.checkEnabled) return;
        const update = await checkForUpdates(json.data.includePrerelease);
        if (update && !json.data.silent) {
          setUpdateInfo(update);
        }
      } catch {
        // 静默处理更新检查错误
      }
    };
    check();
  }, []);

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
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      <ToastContainer />
      {updateInfo && (
        <UpdateDialog
          info={updateInfo}
          onDismiss={() => setUpdateInfo(null)}
          onDownload={() => {
            window.open(updateInfo.url, '_blank');
            setUpdateInfo(null);
          }}
        />
      )}
    </Router>
  );
}
