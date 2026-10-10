import './navbar-gradient.css';

/**
 * Animated gradient background for the application toolbar.
 *
 * Copies the Compose docs navbar background
 * (website/src/components/navigation/NavbarGradient).
 */
export function NavbarGradient() {
  return (
    <div className="app-navbar-gradient-container" aria-hidden="true">
      <div className="app-navbar-gradient-orb-1"></div>
      <div className="app-navbar-gradient-orb-2"></div>
    </div>
  );
}
