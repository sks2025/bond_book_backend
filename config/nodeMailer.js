import nodemailer from 'nodemailer';

// ✅ ZeptoMail SMTP Configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.zeptomail.in',
    port: 587,
    secure: false,  // Use TLS (not SSL) - port 587 uses STARTTLS
    auth: {
        user: 'emailapikey',
        pass: 'PHtE6r0PR+zjg2MvpxIB4aLsR8alYdwo+O9ufwFA5IsTWfEDS01S+dAjlmO2qkgvVvcWRqGTmt9s4LvNteqHdDnsZDofD2qyqK3sx/VYSPOZsbq6x00Vs1QZfkbYUITqcN9o1Szfu9+X',
    },
    requireTLS: true,  // Require TLS encryption
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000
});

// Verify connection on startup
transporter.verify(function (error, success) {
    if (error) {
        console.error('❌ ZeptoMail SMTP Connection Error:', error);
        console.error('Error Details:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode
        });
    } else {
        console.log('✅ ZeptoMail SMTP Server is ready to send emails');
    }
});

// ✅ Function to send email
const sendEmail = async (to, subject, text, html = null) => {
    try {
        console.log('📧 Attempting to send email to:', to);
        console.log('📧 Using ZeptoMail SMTP: smtp.zeptomail.in');
        
        // Explicitly set from email - MUST be login-otp@bondbook.cloud
        const fromEmail = 'login-otp@bondbook.cloud';
        const fromName = 'BondBook Security';
        
        const mailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to,                             // recipient(s)
            subject,
            text,
            html: html || text,
            // Explicitly set reply-to and envelope
            replyTo: fromEmail,
            envelope: {
                from: fromEmail,
                to: to
            }
        };

        console.log('📧 Email Configuration:');
        console.log('   From Email:', fromEmail);
        console.log('   From Name:', fromName);
        console.log('   To:', mailOptions.to);
        console.log('   Subject:', mailOptions.subject);
        console.log('   SMTP Host:', transporter.options.host);

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully via ZeptoMail!');
        console.log('   Message ID:', info.messageId);
        console.log('   Response:', info.response);
        console.log('   From:', info.envelope?.from || fromEmail);
        return info;
    } catch (error) {
        console.error('❌ Email sending failed!');
        console.error('   Error Code:', error.code);
        console.error('   Error Message:', error.message);
        console.error('   Command:', error.command);
        console.error('   Response:', error.response);
        console.error('   Full Error:', error);
        throw error;
    }
};

export default sendEmail;
