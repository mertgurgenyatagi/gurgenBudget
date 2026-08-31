import { lira } from '../money'

export function Settings() {
  return (
    <div className="screen set">
      <div className="top">
        <div className="lbl">Signed in as</div>
        <div className="email">you@example.com</div>
      </div>
      <div className="bottom">
        <div className="row">
          <span>Buffer</span>
          <span className="num">{lira(150)} / day</span>
        </div>
        <div className="signout">Sign out</div>
      </div>
    </div>
  )
}
