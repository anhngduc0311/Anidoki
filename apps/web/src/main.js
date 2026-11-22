import { router } from './router.js';
import { registerRoutes } from './router/routes.js';
import { restoreUserSession, initLoginModal } from './components/AuthModal.js';
import {
  initHeader,
  initGenreDropdown,
  initSearchModal,
  initWatchlistDrawer,
  refreshWatchlistCount
} from './components/Header.js';
import {
  ensureHomeLoaded,
  loadContinueWatching
} from './views/HomeView.js';
import { initDetailEvents } from './views/DetailView.js';
import { initPlayerControls, initReportModal } from './views/PlayerView.js';
import { initBrowseView } from './views/BrowseView.js';
import { initLibraryView } from './views/LibraryView.js';
import { initHistoryView } from './views/HistoryView.js';
import { initAdminView } from './views/AdminView.js';

// ==========================================
// STARTUP BOOTSTRAP
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    registerRoutes();
    initHeader();
    initGenreDropdown();
    const sessionReady = restoreUserSession().then(refreshWatchlistCount);
    initDetailEvents();
    initPlayerControls();
    initReportModal();
    initBrowseView();
    initLibraryView();
    initHistoryView({
      onHistoryChanged: async () => {
        await loadContinueWatching();
      }
    });
    initSearchModal();
    initWatchlistDrawer();
    initLoginModal({
      onLoginSuccess: async () => {
        await refreshWatchlistCount();
        await loadContinueWatching();
      },
      onLogout: async () => {
        await refreshWatchlistCount();
        await loadContinueWatching();
      }
    });
    initAdminView();

    // The public home page can load while the account is being restored.
    if (window.location.pathname === '/') {
      const routeReady = router.handleRoute();
      const { recentReady } = ensureHomeLoaded();
      const backgroundReady = Promise.allSettled([routeReady, sessionReady]);
      await recentReady;
      window.finishStartupLoading?.();
      const failure = (await backgroundReady).find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
    } else {
      window.finishStartupLoading?.();
      await sessionReady;
      if (!router.currentRoute) await router.handleRoute();
    }
  } catch (error) {
    console.error('Không thể hoàn tất khởi tạo AniDoki:', error);
  } finally {
    window.finishStartupLoading?.();
  }
});
