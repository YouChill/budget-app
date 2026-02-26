import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import App from './App.jsx'
import NotesPage from './pages/NotesPage'
import './index.css'

const getRoute = () => {
  const path = window.location.pathname;
  const notesMatch = path.match(/^\/([^/]+)\/notes\/?$/);

  if (notesMatch) {
    return { view: 'notes', workspaceSlug: notesMatch[1] };
  }

  return { view: 'budget' };
};

const Root = () => {
  const [route, setRoute] = React.useState(getRoute);

  React.useEffect(() => {
    const onPopState = () => setRoute(getRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (route.view === 'notes') {
    return <NotesPage workspaceSlug={route.workspaceSlug} />;
  }

  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>,
)
