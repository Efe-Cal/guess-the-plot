import React from 'react';

const PrivacyPolicyContent: React.FC = () => {
  return (
    <div className="privacy-content">
      <div className="privacy-section">
        <h3>1. Information We Collect</h3>
        <p>We collect the information you enter on our website to provide AI-generated responses and fetch TV series data via the OMDB API.</p>
        <p>We do not collect or store any personal information unless voluntarily provided in your input.</p>
      </div>
      
      <div className="privacy-section">
        <h3>2. How We Use Your Information</h3>
        <p>Your input is sent to OpenAI and/or Google to generate AI responses.</p>
        <p>Your input is used to query the OMDB API to fetch relevant TV series information.</p>
        <p>We do not use your data for any other purposes.</p>
      </div>
      
      <div className="privacy-section">
        <h3>3. Data Sharing</h3>
        <p>User input is shared with OpenAI for AI processing. OpenAI's privacy policy applies to their handling of your data. OpenAI can use this data to improve their services, including for improving and training thier models.</p>
        <p>Your input is shared with the OMDB API to retrieve TV series information. OMDB's privacy policy applies to data processed by their service.</p>
        <p>We do not sell, trade, or otherwise share your data with any other third parties.</p>
      </div>
      
      <div className="privacy-section">
        <h3>4. Data Retention</h3>
        <p>We do not store user input. Data is only processed temporarily to generate responses or query the OMDB API.</p>
        <p>Feedback submitted by users is stored temporarily until it is reviewed by the developer and then deleted.</p>
      </div>
      
      <div className="privacy-section">
        <h3>5. Third-Party Services</h3>
        <p>OpenAI and OMDB are third-party services. We are not responsible for their data handling practices.</p>
        <p>Links to other websites are provided for convenience; we are not responsible for third-party privacy practices.</p>
      </div>
      
      <div className="privacy-section">
        <h3>6. Security</h3>
        <p>We take reasonable measures to protect data during transmission to OpenAI and OMDB but cannot guarantee complete security.</p>
      </div>
      
      <div className="privacy-section">
        <h3>7. Children's Privacy</h3>
        <p>Our website is not intended for children under 13. We do not knowingly collect data from children.</p>
      </div>
      
      <div className="privacy-section">
        <h3>8. Changes to This Policy</h3>
        <p>We may update this policy at any time. Changes will be posted on this page.</p>
      </div>
      <div className='privacy-section'>
        <h3>9. Contact Us</h3>
        <p>If you have any questions about this Privacy Policy, please contact me at <a href="mailto:efecaliskan08@gmail.com">this email address </a>.
        </p>
      </div>
    </div>

  );
};

export default PrivacyPolicyContent;
