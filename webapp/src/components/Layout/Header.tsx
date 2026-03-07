interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-dark/95 backdrop-blur-sm border-b border-dark-border lg:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="p-2 -ml-2 text-gray-400 hover:text-gray-200 hover:bg-dark-surface rounded-sharp lg:hidden"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <h2 className="font-semibold text-base md:text-lg text-gray-100 truncate">
        {title}
      </h2>
    </header>
  );
}
