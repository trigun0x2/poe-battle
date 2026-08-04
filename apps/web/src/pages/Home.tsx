import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main className="home">
      <div className="hero">
        <h1>Draft a <em>broken</em> build in five minutes.</h1>
        <p className="lede">
          Eight rounds of shops. Real uniques, real gems, real keystones — and a
          budget of forty Chaos Orbs that will not survive contact with a
          Headhunter. Seal your build, send it to the arena, and read the
          carnage aloud.
        </p>
      </div>
      <div className="modes">
        <Link to="/draft" className="mode-card">
          <h3>Ladder Draft</h3>
          <p><span className="tag">The main event.</span> Draft against your own greed, then your build fights another exile's. Rating on the line.</p>
        </Link>
        <Link to="/daily" className="mode-card">
          <h3>Daily Seed</h3>
          <p><span className="tag">One seed, one attempt.</span> The same shops for everyone, every UTC day. Share the result, spoiler-free.</p>
        </Link>
      </div>
      <p className="notice">
        Exile Draft is a fan-made tribute inspired by Path of Exile. It is not
        affiliated with, endorsed by, or supported by Grinding Gear Games. No
        purchases, no pay-to-win — only bad decisions, freely made.
      </p>
    </main>
  );
}
