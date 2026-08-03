import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Chrome, Footer } from './components/Chrome';
import { FxLayer } from './components/FxLayer';
import { HomePage } from './pages/Home';
import { DraftPage } from './pages/Draft';
import { FightPage } from './pages/Fight';
import { LadderPage } from './pages/Ladder';
import { RoomPage } from './pages/Room';
import { AudiencePage } from './pages/Audience';
import { OverlayPage } from './pages/Overlay';

function Shell() {
  const { pathname } = useLocation();
  const bare = pathname.startsWith('/overlay/');
  if (bare) return <Outlet />;
  return (
    <>
      <Chrome />
      <Outlet />
      <Footer />
      <FxLayer />
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/draft" element={<DraftPage mode="ladder" />} />
        <Route path="/daily" element={<DraftPage mode="daily" />} />
        <Route path="/host/:code" element={<DraftPage mode="ladder" />} />
        <Route path="/challenge/:code" element={<DraftPage mode="challenge" />} />
        <Route path="/fight" element={<FightPage />} />
        <Route path="/ladder" element={<LadderPage />} />
        <Route path="/daily/leaderboard" element={<LadderPage />} />
        <Route path="/room" element={<RoomPage />} />
        <Route path="/r/:code" element={<AudiencePage />} />
        <Route path="/overlay/:code" element={<OverlayPage />} />
      </Route>
    </Routes>
  );
}
