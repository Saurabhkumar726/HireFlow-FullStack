import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
    const year = new Date().getFullYear()

    return (
        <footer className="hf-footer">
            <div className="hf-footer-main">
                <div className="hf-footer-brand-column">
                    <Link className="hf-footer-brand" to="/" aria-label="HireFlow home">
                        <span className="hf-footer-brand-mark" aria-hidden="true">H</span>
                        <span>Hire<span>Flow</span></span>
                    </Link>
                    <p>Where Careers Find Their Flow. Discover meaningful opportunities and build your next chapter with confidence.</p>
                    <Link className="hf-footer-contact-link" to="/contact">Talk to our team <span aria-hidden="true">↗</span></Link>
                </div>

                <nav className="hf-footer-column" aria-label="Explore HireFlow">
                    <h2>Explore</h2>
                    <Link to="/jobs">Find Jobs</Link>
                    <Link to="/companies">Companies</Link>
                    <Link to="/jobs?sort=newest">Latest Opportunities</Link>
                </nav>

                <nav className="hf-footer-column" aria-label="For candidates and recruiters">
                    <h2>For You</h2>
                    <Link to="/candidate/home">Candidate Home</Link>
                    <Link to="/saved-jobs">Saved Jobs</Link>
                    <Link to="/hr">Employer Workspace</Link>
                </nav>

                <nav className="hf-footer-column" aria-label="Company information">
                    <h2>HireFlow</h2>
                    <Link to="/about">About Us</Link>
                    <Link to="/contact">Contact</Link>
                    <Link to="/privacy">Privacy Policy</Link>
                    <Link to="/terms">Terms of Service</Link>
                </nav>
            </div>

            <div className="hf-footer-bottom">
                <span>© {year} HireFlow. All rights reserved.</span>
                <span>Built to make better career connections.</span>
                <a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Back to top ↑</a>
            </div>
        </footer>
    )
}
