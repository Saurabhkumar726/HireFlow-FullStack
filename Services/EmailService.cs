
using System.Net;
using System.Net.Mail;
using System.Globalization;
using Microsoft.Extensions.Configuration;

namespace HireFlow.Api.Services
{
    public interface IEmailService
    {
        Task SendPasswordResetOtpAsync(
            string recipientEmail,
            string otp);

        Task SendInterviewConfirmationAsync(
            string recipientEmail,
            string applicantName,
            string jobTitle,
            DateTime scheduledAt,
            string interviewType,
            string? meetingLink,
            string? notes);

        Task SendHRRegistrationAcknowledgementAsync(string recipientEmail, string fullName);

        Task SendAdminNewHRRegistrationAlertAsync(string recipientEmail, string fullName, string hrEmail);

        Task SendHRApprovalAsync(string recipientEmail, string fullName);

        Task SendHRRejectionAsync(string recipientEmail, string fullName, string? reason);
        Task SendNotificationEmailAsync(string recipientEmail, string subject, string htmlBody);
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

            using var smtpClient = CreateSmtpClient(
                senderEmail,
                smtpServer,
                smtpPort,
                appPassword);

            await smtpClient.SendMailAsync(message);
        }

        public async Task SendInterviewConfirmationAsync(
            string recipientEmail,
            string applicantName,
            string jobTitle,
            DateTime scheduledAt,
            string interviewType,
            string? meetingLink,
            string? notes)
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

            if (!MailAddress.TryCreate(recipientEmail, out _))
            {
                throw new ArgumentException(
                    "The candidate email address is invalid.",
                    nameof(recipientEmail));
            }

            // Database timestamps are expected to represent UTC.
            // If the DateTime has no Kind, treat it as UTC.
            var utcDateTime = scheduledAt.Kind switch
            {
                DateTimeKind.Utc => scheduledAt,
                DateTimeKind.Local => scheduledAt.ToUniversalTime(),
                _ => DateTime.SpecifyKind(
                    scheduledAt,
                    DateTimeKind.Utc)
            };

            var indiaTimeZone = GetIndiaTimeZone();
            var indiaDateTime = TimeZoneInfo.ConvertTimeFromUtc(
                utcDateTime,
                indiaTimeZone);

            var formattedDate = indiaDateTime.ToString(
                "dddd, dd MMMM yyyy",
                CultureInfo.InvariantCulture);

            var formattedTime = indiaDateTime.ToString(
                "hh:mm tt",
                CultureInfo.InvariantCulture);

            var safeApplicantName =
                WebUtility.HtmlEncode(applicantName);

            var safeJobTitle =
                WebUtility.HtmlEncode(jobTitle);

            var safeInterviewType =
                WebUtility.HtmlEncode(interviewType);

            var safeMeetingLink =
                WebUtility.HtmlEncode(meetingLink ?? string.Empty);

            var safeNotes =
                WebUtility.HtmlEncode(notes ?? string.Empty);

            var meetingLinkHtml = string.IsNullOrWhiteSpace(meetingLink)
                ? """
                  <p style="margin:8px 0;color:#666">
                      The hiring team will share the meeting details separately.
                  </p>
                  """
                : $"""
                   <p style="margin:8px 0">
                       <a href="{safeMeetingLink}"
                          style="display:inline-block;background:#6557e8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">
                           Join Interview
                       </a>
                   </p>
                   <p style="font-size:12px;color:#666;word-break:break-all">
                       If the button doesn't work, use this link:<br />
                       {safeMeetingLink}
                   </p>
                   """;

            var notesHtml = string.IsNullOrWhiteSpace(notes)
                ? string.Empty
                : $"""
                   <div style="margin-top:20px;padding:16px;background:#f5f6fa;border-radius:8px">
                       <h3 style="margin-top:0">Additional information</h3>
                       <p style="white-space:pre-line;margin-bottom:0">{safeNotes}</p>
                   </div>
                   """;

            using var message = new MailMessage
            {
                From = new MailAddress(senderEmail, senderName),
                Subject = $"Interview Scheduled - {jobTitle} | HireFlow",
                IsBodyHtml = true,
                Body = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#f4f5f9;font-family:Arial,Helvetica,sans-serif;color:#202337;line-height:1.6">
                        <div style="max-width:620px;margin:24px auto;padding:24px">
                            <div style="background:#6557e8;color:#fff;padding:24px;border-radius:12px 12px 0 0">
                                <h1 style="margin:0;font-size:25px">HireFlow</h1>
                                <p style="margin:8px 0 0">Interview confirmation</p>
                            </div>

                            <div style="background:#fff;padding:28px;border:1px solid #e3e5ee;border-top:0;border-radius:0 0 12px 12px">
                                <h2 style="margin-top:0">Your interview is scheduled!</h2>

                                <p>Dear {safeApplicantName},</p>

                                <p>
                                    Thank you for your interest. Your interview has been scheduled.
                                    Please review the details below and keep this email for reference.
                                </p>

                                <div style="margin:24px 0;padding:20px;background:#f7f7fc;border:1px solid #e6e5fb;border-radius:10px">
                                    <p style="margin:0 0 14px">
                                        <strong>Position</strong><br />
                                        {safeJobTitle}
                                    </p>

                                    <p style="margin:0 0 14px">
                                        <strong>Date</strong><br />
                                        {WebUtility.HtmlEncode(formattedDate)}
                                    </p>

                                    <p style="margin:0 0 14px">
                                        <strong>Time</strong><br />
                                        {WebUtility.HtmlEncode(formattedTime)} IST
                                    </p>

                                    <p style="margin:0">
                                        <strong>Interview type</strong><br />
                                        {safeInterviewType}
                                    </p>
                                </div>

                                <h3>Meeting details</h3>
                                {meetingLinkHtml}

                                {notesHtml}

                                <p style="margin-top:24px">
                                    Please join on time. If you need to reschedule or have questions,
                                    contact the hiring team.
                                </p>

                                <p>
                                    Best regards,<br />
                                    <strong>{WebUtility.HtmlEncode(senderName)}</strong>
                                </p>

                                <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />

                                <p style="font-size:12px;color:#777;margin-bottom:0">
                                    This is an automated interview confirmation from HireFlow.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                    """
            };

            message.To.Add(new MailAddress(recipientEmail));

            using var smtpClient = CreateSmtpClient(
                senderEmail,
                smtpServer,
                smtpPort,
                appPassword);

            await smtpClient.SendMailAsync(message);
        }

        public async Task SendHRRegistrationAcknowledgementAsync(
            string recipientEmail,
            string fullName)
        {
            var safeName = WebUtility.HtmlEncode(fullName);
            var body = BuildAccountEmail(
                "Your HireFlow employer registration is under review",
                $"<p>Hello {safeName},</p>" +
                "<p>Thank you for registering with HireFlow. Your employer account is currently under review by our admin team.</p>" +
                "<p>We'll email you when a decision has been made. You don't need to register again.</p>");

            await SendHtmlEmailAsync(
                recipientEmail,
                "HireFlow employer registration received",
                body);
        }

        public async Task SendAdminNewHRRegistrationAlertAsync(
            string recipientEmail,
            string fullName,
            string hrEmail)
        {
            var safeName = WebUtility.HtmlEncode(fullName);
            var safeEmail = WebUtility.HtmlEncode(hrEmail);
            var body = BuildAccountEmail(
                "New employer registration requires review",
                $"<p>A new HR/employer account has registered and is awaiting review.</p>" +
                $"<p><strong>Name:</strong> {safeName}<br /><strong>Email:</strong> {safeEmail}</p>" +
                "<p>Sign in to the HireFlow admin portal to review this registration.</p>");

            await SendHtmlEmailAsync(
                recipientEmail,
                "HireFlow: new HR registration awaiting review",
                body);
        }

        public async Task SendHRApprovalAsync(
            string recipientEmail,
            string fullName)
        {
            var safeName = WebUtility.HtmlEncode(fullName);
            var loginUrl = BuildFrontendUrl("EmailSettings:LoginPath", "/login");
            var dashboardUrl = BuildFrontendUrl("EmailSettings:HRDashboardPath", "/hrhome/hr");
            var safeLoginUrl = WebUtility.HtmlEncode(loginUrl);
            var safeDashboardUrl = WebUtility.HtmlEncode(dashboardUrl);

            var body = BuildAccountEmail(
                "Your HireFlow employer account is approved",
                $"<p>Hello {safeName},</p>" +
                "<p>Good news — your HireFlow employer account has been approved.</p>" +
                $"<p><a href=\"{safeLoginUrl}\">Sign in to HireFlow</a> to get started.</p>" +
                $"<p>Once signed in, open your <a href=\"{safeDashboardUrl}\">HR dashboard</a> to complete your company setup and post your first job.</p>");

            await SendHtmlEmailAsync(
                recipientEmail,
                "Your HireFlow employer account has been approved",
                body);
        }

        public async Task SendHRRejectionAsync(
            string recipientEmail,
            string fullName,
            string? reason)
        {
            var safeName = WebUtility.HtmlEncode(fullName);
            var safeReason = WebUtility.HtmlEncode(
                string.IsNullOrWhiteSpace(reason)
                    ? "After reviewing the information provided, we are unable to approve the employer account at this time. Please contact support if you need clarification."
                    : reason.Trim());

            var body = BuildAccountEmail(
                "Update about your HireFlow employer registration",
                $"<p>Hello {safeName},</p>" +
                "<p>Thank you for your interest in HireFlow. Unfortunately, we are unable to approve your employer registration at this time.</p>" +
                $"<p><strong>Reason provided:</strong><br />{safeReason}</p>" +
                "<p>If you believe this decision was made in error or need assistance, contact <a href=\"mailto:support@hireflow.com\">support@hireflow.com</a>.</p>");

            await SendHtmlEmailAsync(
                recipientEmail,
                "Update on your HireFlow employer registration",
                body);
        }

        public Task SendNotificationEmailAsync(
            string recipientEmail,
            string subject,
            string htmlBody)
        {
            return SendHtmlEmailAsync(recipientEmail, subject, htmlBody);
        }

        private async Task SendHtmlEmailAsync(
            string recipientEmail,
            string subject,
            string htmlBody)
        {
            if (!MailAddress.TryCreate(recipientEmail, out _))
            {
                throw new ArgumentException("The recipient email address is invalid.", nameof(recipientEmail));
            }

            var senderEmail = GetRequiredSetting("EmailSettings:SenderEmail");
            var senderName = GetRequiredSetting("EmailSettings:SenderName");
            var smtpServer = GetRequiredSetting("EmailSettings:SmtpServer");
            var smtpPortText = GetRequiredSetting("EmailSettings:SmtpPort");
            var appPassword = GetRequiredSetting("EmailSettings:AppPassword");

            if (!int.TryParse(smtpPortText, out var smtpPort) || smtpPort is < 1 or > 65535)
            {
                throw new InvalidOperationException("The SMTP port configuration is invalid.");
            }

            using var message = new MailMessage
            {
                From = new MailAddress(senderEmail, senderName),
                Subject = subject,
                IsBodyHtml = true,
                Body = htmlBody
            };
            message.To.Add(new MailAddress(recipientEmail));

            using var smtpClient = CreateSmtpClient(senderEmail, smtpServer, smtpPort, appPassword);
            await smtpClient.SendMailAsync(message);
        }

        private string BuildAccountEmail(string heading, string content)
        {
            var safeHeading = WebUtility.HtmlEncode(heading);
            var safeSenderName = WebUtility.HtmlEncode(
                _configuration["EmailSettings:SenderName"] ?? "HireFlow");

            return $"""
                <!DOCTYPE html>
                <html><body style="margin:0;padding:24px;background:#f4f5f9;font-family:Arial,Helvetica,sans-serif;color:#202337;line-height:1.6">
                  <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e3e5ee;border-radius:12px;overflow:hidden">
                    <div style="background:#6557e8;color:#fff;padding:22px 26px"><h1 style="margin:0;font-size:24px">HireFlow</h1></div>
                    <div style="padding:26px"><h2 style="margin-top:0">{safeHeading}</h2>{content}
                      <p style="margin-top:28px">Best regards,<br /><strong>{safeSenderName}</strong></p>
                      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
                      <p style="font-size:12px;color:#777;margin-bottom:0">This is an automated message from HireFlow. Please do not reply directly to this email.</p>
                    </div>
                  </div>
                </body></html>
                """;
        }

        private string BuildFrontendUrl(string settingKey, string defaultPath)
        {
            var baseUrl = (_configuration["EmailSettings:FrontendBaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
            var path = _configuration[settingKey];
            if (string.IsNullOrWhiteSpace(path)) path = defaultPath;
            return $"{baseUrl}/{path.TrimStart('/')}";
        }

        private SmtpClient CreateSmtpClient(
            string senderEmail,
            string smtpServer,
            int smtpPort,
            string appPassword)
        {
            return new SmtpClient(smtpServer, smtpPort)
            {
                EnableSsl = true,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(
                    senderEmail,
                    appPassword),
                Timeout = 15000
            };
        }

        private TimeZoneInfo GetIndiaTimeZone()
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(
                    "India Standard Time");
            }
            catch (TimeZoneNotFoundException)
            {
                // Fallback for systems using IANA timezone identifiers.
                return TimeZoneInfo.FindSystemTimeZoneById(
                    "Asia/Kolkata");
            }
        }

        private string GetRequiredSetting(string key)
        {
            return _configuration[key]
                ?? throw new InvalidOperationException(
                    $"Required email setting '{key}' is missing.");
        }
    }
}
