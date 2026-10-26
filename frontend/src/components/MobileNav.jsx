import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, LayoutGrid, Star, UserRound } from 'lucide-react';
import { useStore } from '../store/useStore';

const TABS = [
  { id: 'notes', label: 'Notes', icon: LayoutGrid },
  { id: 'todos', label: 'Todos', icon: CheckCircle2 },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 };

const isTextField = (el) =>
  el instanceof HTMLElement &&
  (el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable);

export default function MobileNav() {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);
  const todos = useStore((s) => s.todos);
  const reduceMotion = useStore((s) => s.settings.reduceMotion);
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);

  const pendingTodos = React.useMemo(
    () => todos.filter((todo) => !todo.completed).length,
    [todos]
  );

  // On phones the on-screen keyboard would sit under the bar. Slide it away
  // while a text field is focused so the field and suggestions stay visible.
  React.useEffect(() => {
    if (!window.matchMedia) return undefined;
    const coarse = window.matchMedia('(pointer: coarse)');
    const sync = (el) => setKeyboardOpen(coarse.matches && isTextField(el));
    const onFocusIn = (event) => sync(event.target);
    const onFocusOut = (event) => sync(event.relatedTarget);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const selectTab = (id) => {
    if (id === activeView) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      return;
    }
    setActiveView(id);
  };

  return (
    <motion.nav
      aria-label="Primary tabs"
      initial={{ y: '110%', opacity: 0 }}
      animate={{
        y: keyboardOpen ? '110%' : 0,
        opacity: keyboardOpen ? 0 : 1,
      }}
      transition={SPRING}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-panel/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[0_-10px_34px_-24px_rgba(17,16,24,0.45)] backdrop-blur-xl md:hidden ${
        keyboardOpen ? 'pointer-events-none' : ''
      }`}
    >
      <div className="mx-auto flex h-14 max-w-md items-stretch px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          const showBadge = tab.id === 'todos' && pendingTodos > 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-nav-active"
                  className="absolute inset-x-1.5 inset-y-1 rounded-2xl bg-accent/10"
                  transition={SPRING}
                  aria-hidden="true"
                />
              )}
              <motion.span
                className="relative flex items-center justify-center"
                animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.08 : 1 }}
                whileTap={{ scale: 0.85 }}
                transition={SPRING}
              >
                <Icon
                  className={`h-[19px] w-[19px] transition-colors duration-200 ${
                    isActive ? 'text-accent' : 'text-faint'
                  }`}
                  aria-hidden="true"
                />
                {showBadge && (
                  <span
                    className="absolute -right-2.5 -top-2 flex min-w-[15px] items-center justify-center rounded-full bg-pop-pink px-1 text-[9px] font-bold leading-[15px] text-white ring-2 ring-panel"
                    aria-hidden="true"
                  >
                    {pendingTodos > 9 ? '9+' : pendingTodos}
                  </span>
                )}
              </motion.span>
              <span
                className={`relative truncate text-[10px] font-medium leading-none transition-colors duration-200 ${
                  isActive ? 'text-accent' : 'text-faint'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
