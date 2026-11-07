import { ToastProvider } from './components/ui';
import { useRoute } from './lib/router';
import { CreatePage } from './pages/Create';
import { HomePage } from './pages/Home';
import { TournamentPage } from './pages/Tournament';
import { TvPage } from './pages/Tv';

export function App() {
  const route = useRoute();
  return (
    <ToastProvider>
      {route.name === 'inicio' && <HomePage />}
      {route.name === 'novo' && <CreatePage />}
      {route.name === 'torneio' && <TournamentPage key={route.code} code={route.code} />}
      {route.name === 'telao' && <TvPage key={route.code} code={route.code} />}
    </ToastProvider>
  );
}
