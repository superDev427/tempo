import Board from './components/Board/Board';
import { useNotes } from './state/useNotes';

export default function App() {
  const api = useNotes();
  return <Board api={api} />;
}
