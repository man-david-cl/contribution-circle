import Link from 'next/link';

const features = [
  { number: '01', title: 'One clear recipient', description: "Everyone can see whose turn is active." },
  { number: '02', title: 'Track every cycle', description: 'Keep expected and received contributions organized.' },
  { number: '03', title: 'Verified withdrawals', description: 'Requests are reviewed before the rotation moves.' },
];

export default function Home() {
  return (
    <main className="container">
      <header className="nav landing-nav">
        <Link href="/" className="brand" aria-label="Contribution Circle home">contribution<span>circle.</span></Link>
        <div className="nav-actions">
          <Link className="btn btn-secondary" href="/login">Log in</Link>
          <Link className="btn btn-primary" href="/register">Join your circle</Link>
        </div>
      </header>

      <section className="hero hero-layout">
        <div className="hero-copy">
          <div className="eyebrow">A clearer way to contribute together</div>
          <h1 className="hero-title">Your turn.<br /><span>Your circle.</span><br />All in sync.</h1>
          <p className="muted hero-description">
            Keep your rotating contribution group organized. See whose turn it is,
            track monthly contributions, and manage withdrawal requests with a clear
            record for every cycle.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/register">Get started <span aria-hidden="true">→</span></Link>
            <Link className="btn btn-secondary" href="/login">Member login</Link>
          </div>
        </div>

        <div className="card hero-preview">
          <div className="eyebrow">Current recipient</div>
          <div className="preview-person">
            <div className="preview-avatar" aria-hidden="true">01</div>
            <div>
              <strong>Recipient details</strong>
              <div className="muted preview-caption">Visible to approved members</div>
            </div>
          </div>
          <div className="preview-divider" />
          <div className="preview-details">
            {['Full name', 'Member position', 'Bank details', 'Next cycle'].map((item) => (
              <div key={item}>
                <div className="muted preview-label">{item}</div>
                <strong className="preview-value">Shown in your dashboard</strong>
              </div>
            ))}
          </div>
          <div className="preview-note">Rotation advances only after payment is confirmed.</div>
        </div>
      </section>

      <section className="features-section">
        <div className="eyebrow">Built around trust and clarity</div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="card feature-card" key={feature.number}>
              <div className="eyebrow">{feature.number}</div>
              <h3>{feature.title}</h3>
              <p className="muted">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">Contribution Circle · Private group contribution management</footer>
    </main>
  );
}
