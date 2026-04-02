import { useGameStore } from './lib/store';
import Menu from './pages/Menu';
import Game from './pages/Game';
import './App.css';

function App() {
  const screen = useGameStore((s) => s.screen);

  return (
    <div className="app">
      {screen === 'menu' && <Menu />}
      {(screen === 'game' || screen === 'gameover') && <Game />}
    </div>
  );
}

export default App;
