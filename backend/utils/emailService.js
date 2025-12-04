import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // or use 'smtp.gmail.com'
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD // Use App Password for Gmail
  }
});

// Send OTP email
export const sendOTPEmail = async (email, otp, name) => {
  const mailOptions = {
    from: `"Arclight" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - Arclight',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <!--[if mso]>
        <style type="text/css">
          body, table, td {font-family: Arial, sans-serif !important;}
        </style>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 20px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; border-radius: 20px; overflow: hidden;">
                <!-- Email Container -->
                <tr>
                  <td style="background-color: #e8e8e8; border-radius: 20px;">
                    <!-- Header with Gradient -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background: linear-gradient(to right, #2a2a2a 0%, #87ceeb 100%); padding: 50px 30px; text-align: center; border-radius: 20px 20px 0 0;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 42px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; line-height: 1.2; font-family: Arial, Helvetica, sans-serif;">
                            WELCOME TO ARCLIGHT!
                          </h1>
                        </td>
                      </tr>
                    </table>
                    <!-- Content -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e8e8e8;">
                      <tr>
                        <td style="padding: 40px 30px;">
                          <!-- Greeting -->
                          <p style="margin: 0 0 20px 0; font-size: 18px; color: #000000; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">
                            Hello ${name}!
                          </p>
                          <!-- Message -->
                          <p style="margin: 0 0 30px 0; font-size: 15px; color: #000000; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">
                            Thank you for signing up! Please verify your email address to complete your registration, by entering the One-Time Password (OTP) below in the app.
                          </p>
                          <!-- OTP Box -->
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0; border: 2px dashed #17a2b8; background-color: #e8e8e8; border-radius: 8px;">
                            <tr>
                              <td style="padding: 30px; text-align: center; border-radius: 8px;">
                                <p style="margin: 0 0 15px 0; font-size: 15px; color: #000000; font-weight: 600; text-align: left; font-family: Arial, Helvetica, sans-serif;">
                                  Your OTP is:
                                </p>
                                <div style="font-size: 72px; font-weight: 700; color: #17a2b8; letter-spacing: 4px; margin: 20px 0; font-family: Arial, Helvetica, sans-serif;">
                                  ${otp}
                                </div>
                                <p style="margin: 15px 0 0 0; font-size: 13px; color: #999999; font-family: Arial, Helvetica, sans-serif;">
                                  This code will expire in 10 minutes.
                                </p>
                              </td>
                            </tr>
                          </table>
                          <!-- Note -->
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #000000; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">
                            <strong>Note:</strong> If you didn't request this verification, please ignore the mail.
                          </p>
                          <!-- Divider -->
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                            <tr>
                              <td style="height: 1px; background-color: #000000;"></td>
                            </tr>
                          </table>
                          <!-- Security Tip -->
                          <p style="margin: 20px 0 0 0; font-size: 14px; color: #000000; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">
                            <strong>Security Tip:</strong> Never share this OTP with anyone. We will never ask for your OTP.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Send welcome email after verification
export const sendWelcomeEmail = async (email, name) => {
  const mailOptions = {
    from: `"Arclight" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome Aboard! - Arclight',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <!--[if mso]>
        <style type="text/css">
          body, table, td {font-family: Arial, sans-serif !important;}
        </style>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 20px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; border-radius: 20px; overflow: hidden;">
                <!-- Email Container -->
                <tr>
                  <td style="background-color: #e8e8e8; border-radius: 20px;">
                    <!-- Header with Gradient -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #4a5fd9 0%, #6b46c1 25%, #9333ea 50%, #7c3aed 75%, #06b6d4 100%); padding: 50px 30px; text-align: center; border-radius: 20px 20px 0 0;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 42px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; line-height: 1.2; font-family: Arial, Helvetica, sans-serif; text-shadow: 0 2px 20px rgba(0,0,0,0.3);">
                            WELCOME ABOARD!
                          </h1>
                        </td>
                      </tr>
                    </table>
                    <!-- Content -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #e8e8e8;">
                      <tr>
                        <td style="padding: 40px 30px;">
                          <!-- Greeting -->
                          <p style="margin: 0 0 20px 0; font-size: 18px; color: #000000; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">
                            Dear <strong>${name}</strong>,
                          </p>
                          <!-- Message -->
                          <p style="margin: 0 0 20px 0; font-size: 15px; color: #000000; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">
                            Your email has been successfully verified!
                          </p>
                          <p style="margin: 0 0 20px 0; font-size: 15px; color: #000000; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">
                            You can now access all features of Arclight, including the AI features. Start exploring and enjoy your journey with us.
                          </p>
                          <p style="margin: 0 0 30px 0; font-size: 15px; color: #000000; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">
                            If you have any questions or need assistance, feel free to reach out to us.
                          </p>
                          <!-- Closing -->
                          <p style="margin: 30px 0 0 0; font-size: 15px; color: #000000; line-height: 1.6; font-family: Arial, Helvetica, sans-serif;">
                            Best regards,<br><strong>Arclight Support</strong>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent: ' + info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw error for welcome email, just log it
    return { success: false };
  }
};
