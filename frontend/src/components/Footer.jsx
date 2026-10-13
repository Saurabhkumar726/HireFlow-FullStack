const Footer = () => {
    const year = new Date().getFullYear()

    return (
        <footer className="site-footer" id="site-footer">
            <div className="footer-main">
                <div className="footer-about">
                    <a className="brand footer-brand" href="#home" aria-label="HireFlow home">
                        <span className="brand-mark">H</span>
                        <span>hire<span className="brand-accent">flow</span></span>
                    </a>
                    <p className="footer-description">
                        Find work that moves you forward. Discover opportunities, explore
                        career paths, and take your next step with HireFlow.
                    </p>
                    <a className="footer-email" href="mailto:hello@hireflow.example">
                        Contact HireFlow <span aria-hidden="true">↗</span>
                    </a>
                </div>

                <nav className="footer-column" aria-label="Explore HireFlow">
                    <h3>Explore</h3>
                    <a href="#jobs">Browse jobs</a>
                    <a href="#categories">Job categories</a>
                    <a href="#about">How HireFlow works</a>
                </nav>

                <nav className="footer-column" aria-label="For candidates">
                    <h3>For candidates</h3>
                    <a href="#jobs">Find a job</a>
                    <a href="#jobs">Featured opportunities</a>
                    <a href="#jobs">Application tips</a>
                </nav>

                <nav className="footer-column" aria-label="Company and support">
                    <h3>HireFlow</h3>
                    <a href="#about">About us</a>
                    <a href="mailto:hello@hireflow.example?subject=HireFlow%20Support">Contact & support</a>
                    <a href="#home">Back to top ↑</a>
                </nav>
            </div>

            <div className="footer-bottom">
                <p>© {year} HireFlow. All rights reserved.</p>
                <p className="footer-note">Built to help your next opportunity find you.</p>
                <a href="#home" className="footer-back-top">Back to top ↑</a>
            </div>
        </footer>
    )
}

export default Footer
