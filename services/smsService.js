const nodemailer = require("nodemailer");

// SMS Gateway mappings for different carriers
const SMS_GATEWAYS = {
  verizon: "vtext.com",
  att: "txt.att.net", 
  tmobile: "tmomail.net",
  sprint: "messaging.sprintpcs.com",
  // Additional Indian carriers
  airtel: "airtelmail.com",
  jio: "jiomail.com",
  vodafone: "vodafonemail.com"
};

// Create nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App password, not regular password
    },
  });
};

// Send SMS via email-to-SMS gateway
const sendSMS = async (phoneNumber, carrier, message) => {
  try {
    const gateway = SMS_GATEWAYS[carrier];
    if (!gateway) {
      throw new Error(`Unsupported carrier: ${carrier}`);
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: `${phoneNumber}@${gateway}`,
      subject: "", // Empty subject for SMS
      text: message,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ SMS sent successfully to ${phoneNumber} via ${carrier}:`, result.messageId);
    return {
      success: true,
      messageId: result.messageId,
      message: "SMS sent successfully"
    };
  } catch (error) {
    console.error(`❌ Error sending SMS to ${phoneNumber}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via SMS
const sendOTPSMS = async (phoneNumber, carrier) => {
  try {
    const otp = generateOTP();
    const message = `Your Astra Preschool verification code is: ${otp}. This code will expire in 5 minutes. Do not share this code with anyone.`;
    
    const result = await sendSMS(phoneNumber, carrier, message);
    
    if (result.success) {
      return {
        success: true,
        otp: otp,
        message: "OTP sent successfully"
      };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error sending OTP SMS:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send payment confirmation SMS
const sendPaymentConfirmationSMS = async (phoneNumber, carrier, paymentDetails) => {
  try {
    const { studentName, amount, receiptNumber } = paymentDetails;
    const message = `Payment Confirmed! ₹${amount} received for ${studentName}. Receipt: ${receiptNumber}. Thank you! - Astra Preschool`;
    
    return await sendSMS(phoneNumber, carrier, message);
  } catch (error) {
    console.error('Error sending payment confirmation SMS:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send fee reminder SMS
const sendFeeReminderSMS = async (phoneNumber, carrier, reminderDetails) => {
  try {
    const { studentName, balance, dueDate } = reminderDetails;
    const message = `Fee Reminder: ₹${balance} pending for ${studentName}. Due: ${dueDate}. Please pay at your earliest. - Astra Preschool`;
    
    return await sendSMS(phoneNumber, carrier, message);
  } catch (error) {
    console.error('Error sending fee reminder SMS:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send welcome SMS for new registrations
const sendWelcomeSMS = async (phoneNumber, carrier, studentName) => {
  try {
    const message = `Welcome to Astra Preschool! ${studentName} has been successfully registered. You can now login to view details and make payments. Thank you!`;
    
    return await sendSMS(phoneNumber, carrier, message);
  } catch (error) {
    console.error('Error sending welcome SMS:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Detect carrier from phone number (basic implementation)
const detectCarrier = (phoneNumber) => {
  // This is a simplified carrier detection
  // In a real implementation, you'd use a carrier lookup service
  const firstDigit = phoneNumber.charAt(0);
  
  // Basic Indian number carrier detection
  if (['6', '7', '8', '9'].includes(firstDigit)) {
    return 'airtel'; // Default to Airtel for Indian numbers
  }
  
  return 'tmobile'; // Default fallback
};

// Validate phone number format
const validatePhoneNumber = (phoneNumber) => {
  // Remove all non-digits
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a valid Indian mobile number (10 digits starting with 6-9)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return {
      isValid: true,
      cleanedNumber: cleaned,
      format: 'indian'
    };
  }
  
  // Check if it's a US number (10 digits)
  if (/^\d{10}$/.test(cleaned)) {
    return {
      isValid: true,
      cleanedNumber: cleaned,
      format: 'us'
    };
  }
  
  return {
    isValid: false,
    error: 'Invalid phone number format'
  };
};

module.exports = {
  sendSMS,
  generateOTP,
  sendOTPSMS,
  sendPaymentConfirmationSMS,
  sendFeeReminderSMS,
  sendWelcomeSMS,
  detectCarrier,
  validatePhoneNumber,
  SMS_GATEWAYS
};
