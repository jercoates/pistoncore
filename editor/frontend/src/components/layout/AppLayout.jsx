import { Outlet, NavLink } from 'react-router-dom'
import './AppLayout.css'

export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-logo">PistonCore</span>
        <span className="app-tagline">Visual automation builder for Home Assistant</span>
      </header>
      <div className="app-body">
        <nav className="app-nav">
          <NavLink to="/pistons" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            My Pistons
          </NavLink>
          <NavLink to="/globals" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Global Variables
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Settings
          </NavLink>
        </nav>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
