
using System.Net;
using System.Net.Mail;

namespace HireFlow.Api.Services
{
    public interface IEmailService
    {
        Task SendPasswordResetOtpAsync(
            string recipientEmail,
            string otp);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;

        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendPasswordResetOtpAsync(
            string recipientEmail,
            string otp)
        {
            var senderEmail = GetRequiredSetting(
                "EmailSettings:SenderEmail");

            var senderName = GetRequiredSetting(
                "EmailSettings:SenderName");

            var smtpServer = GetRequiredSetting(
                "EmailSettings:SmtpServer");

            var smtpPortText = GetRequiredSetting(
                "EmailSettings:SmtpPort");

            var appPassword = GetRequiredSetting(
                "EmailSettings:AppPassword");

            if (!int.TryParse(smtpPortText, out var smtpPort))
            {
                throw new InvalidOperationException(
                    "The SMTP port configuration is invalid.");
            }

            using var message = new MailMessage
            {
                From = new MailAddress(senderEmail, senderName),
                Subject = "Your HireFlow password reset code",
                IsBodyHtml = true,
                Body = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="font-family:Arial,sans-serif;color:#222;line-height:1.6">
                        <div style="max-width:520px;margin:20px auto;padding:24px;border:1px solid #ddd;border-radius:12px">
                            <h2 style="margin-top:0">Reset your HireFlow password</h2>
                            <p>We received a request to reset your HireFlow account password.</p>
                            <p>Your verification code is:</p>
                            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">
                                {WebUtility.HtmlEncode(otp)}
                            </div>
                            <p>This code expires in <strong>10 minutes</strong>.</p>
                            <p>If you did not request this reset, you can safely ignore this email.</p>
                            <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                            <p style="font-size:12px;color:#666">HireFlow account security</p>
                        </div>
                    </body>
                    </html>
                    """
            };

            message.To.Add(new MailAddress(recipientEmail));

            using var smtpClient = new SmtpClient(
                smtpServer,
                smtpPort)
            {
                EnableSsl = true,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(
                    senderEmail,
                    appPassword),
                Timeout = 15000
            };

            await smtpClient.SendMailAsync(message);
        }

        private string GetRequiredSetting(string key)
        {
            return _configuration[key]
                ?? throw new InvalidOperationException(
                    $"Required email setting '{key}' is missing.");
        }
    }
}
