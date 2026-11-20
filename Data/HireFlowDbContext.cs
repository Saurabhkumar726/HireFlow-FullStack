using HireFlow.Api.Authentication;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Data
{
    public class HireFlowDbContext : IdentityDbContext<ApplicationUser>
    {
        public HireFlowDbContext(DbContextOptions<HireFlowDbContext> options)
            : base(options)
        {
        }

        public DbSet<Job> Jobs { get; set; }
        public DbSet<CityLocation> CityLocations { get; set; }
        public DbSet<JobApplication> JobApplications { get; set; }
        public DbSet<JobApplicationStatusHistory> JobApplicationStatusHistory { get; set; }
        public DbSet<JobApplicationRevision> JobApplicationRevisions { get; set; }
        public DbSet<Interview> Interviews { get; set; }
        public DbSet<PasswordResetOtp> PasswordResetOtps { get; set; }
        public DbSet<SavedJob> SavedJobs { get; set; }
        public DbSet<SavedJobCollection> SavedJobCollections { get; set; }
        public DbSet<SavedJobCollectionItem> SavedJobCollectionItems { get; set; }
        public DbSet<Company> Companies { get; set; }
        public DbSet<CandidateJobPreference> CandidateJobPreferences { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<NotificationPreference> NotificationPreferences { get; set; }
        public DbSet<EmailOutboxMessage> EmailOutboxMessages { get; set; }
        public DbSet<JobScreeningQuestion> JobScreeningQuestions { get; set; }
        public DbSet<JobApplicationScreeningAnswer> JobApplicationScreeningAnswers { get; set; }
        public DbSet<InterviewFeedback> InterviewFeedback { get; set; }
        public DbSet<InterviewReminderLog> InterviewReminderLogs { get; set; }

        public DbSet<CandidateEmployment> CandidateEmployments { get; set; }
        public DbSet<CandidateEducation> CandidateEducations { get; set; }
        public DbSet<CandidateProject> CandidateProjects { get; set; }
        public DbSet<CandidateSkill> CandidateSkills { get; set; }
        public DbSet<CandidateAccomplishment> CandidateAccomplishments { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<ApplicationUser>()
                .HasIndex(user => user.GoogleSubject)
                .IsUnique()
                .HasFilter("[GoogleSubject] IS NOT NULL");

            modelBuilder.Entity<Job>()
                .Property(job => job.Salary)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Job>()
                .Property(job => job.EducationRequirement)
                .HasMaxLength(150);

            modelBuilder.Entity<Job>()
                .Property(job => job.SalaryMax)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Job>()
                .Property(job => job.WorkMode)
                .HasMaxLength(30)
                .HasDefaultValue("Not specified");

            modelBuilder.Entity<Job>()
                .Property(job => job.SalaryMode)
                .HasMaxLength(30)
                .HasDefaultValue("Range");

            modelBuilder.Entity<Job>()
                .Property(job => job.SalaryCurrency)
                .HasMaxLength(3)
                .HasDefaultValue("INR");

            modelBuilder.Entity<Job>()
                .Property(job => job.SalaryPeriod)
                .HasMaxLength(20)
                .HasDefaultValue("Monthly");

            modelBuilder.Entity<Job>()
                .Property(job => job.PublicationStatus)
                .HasMaxLength(30)
                .HasDefaultValue("Published");

            modelBuilder.Entity<Job>()
                .Property(job => job.IsActive)
                .HasDefaultValue(true);

            modelBuilder.Entity<Job>()
                .Property(job => job.IsFeatured)
                .HasDefaultValue(false);

            modelBuilder.Entity<Job>()
                .Property(job => job.RequireResume)
                .HasDefaultValue(false);

            modelBuilder.Entity<Job>()
                .HasIndex(job => new
                {
                    job.PublicationStatus,
                    job.IsActive,
                    job.ApplicationDeadlineUtc,
                    job.CreatedAt
                });

            modelBuilder.Entity<Job>()
                .HasIndex(job => new
                {
                    job.IsFeatured,
                    job.PublicationStatus,
                    job.IsActive
                });

            modelBuilder.Entity<ApplicationUser>()
                .Property(user => user.ExpectedSalary)
                .HasPrecision(18, 2);

            modelBuilder.Entity<CandidateEducation>()
                .Property(education => education.Grade)
                .HasPrecision(5, 2);

            modelBuilder.Entity<JobApplication>()
                .HasOne(application => application.Job)
                .WithMany(job => job.Applications)
                .HasForeignKey(application => application.JobId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<JobApplication>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(application => application.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<JobApplication>()
                .Property(application => application.Status)
                .HasMaxLength(40)
                .HasDefaultValue("Pending")
                .IsRequired();

            modelBuilder.Entity<JobApplication>()
                .Property(application => application.RevisionNumber)
                .HasDefaultValue(0);

            modelBuilder.Entity<JobApplication>()
                .HasIndex(application => new { application.UserId, application.JobId, application.Status });

            modelBuilder.Entity<JobApplication>()
                .HasIndex(application => new { application.JobId, application.AppliedAt });

            modelBuilder.Entity<JobApplicationStatusHistory>()
                .HasIndex(history => new { history.JobApplicationId, history.ChangedAtUtc });

            modelBuilder.Entity<JobApplicationStatusHistory>()
                .HasOne(history => history.JobApplication)
                .WithMany(application => application.StatusHistory)
                .HasForeignKey(history => history.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<JobApplicationRevision>()
                .HasIndex(revision => new { revision.JobApplicationId, revision.RevisionNumber })
                .IsUnique();

            modelBuilder.Entity<JobApplicationRevision>()
                .HasOne(revision => revision.JobApplication)
                .WithMany(application => application.Revisions)
                .HasForeignKey(revision => revision.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Job>()
                .HasOne(job => job.CreatedByUser)
                .WithMany()
                .HasForeignKey(job => job.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Interview>()
                .HasOne(interview => interview.JobApplication)
                .WithMany(application => application.Interviews)
                .HasForeignKey(interview => interview.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PasswordResetOtp>()
                .HasIndex(otp => new { otp.UserId, otp.CreatedAt });

            modelBuilder.Entity<CandidateSkill>()
                .HasIndex(skill => new
                {
                    skill.UserId,
                    skill.Category,
                    skill.SkillName
                })
                .IsUnique();

            modelBuilder.Entity<CandidateEmployment>()
                .HasIndex(employment => employment.UserId);

            modelBuilder.Entity<CandidateEducation>()
                .HasIndex(education => education.UserId);

            modelBuilder.Entity<CandidateProject>()
                .HasIndex(project => project.UserId);

            modelBuilder.Entity<CandidateAccomplishment>()
                .HasIndex(accomplishment => accomplishment.UserId);


            // A Student can save a job only once. Deleting a job removes its
            // bookmark records, while closing a job does not affect saved history.
            modelBuilder.Entity<SavedJob>()
                .HasIndex(savedJob => new { savedJob.UserId, savedJob.JobId })
                .IsUnique();

            modelBuilder.Entity<SavedJob>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(savedJob => savedJob.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SavedJob>()
                .HasOne(savedJob => savedJob.Job)
                .WithMany()
                .HasForeignKey(savedJob => savedJob.JobId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SavedJobCollection>()
                .HasIndex(collection => new { collection.UserId, collection.Name })
                .IsUnique();

            modelBuilder.Entity<SavedJobCollection>()
                .Property(collection => collection.Name)
                .HasMaxLength(40)
                .IsRequired();

            modelBuilder.Entity<SavedJobCollection>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(collection => collection.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SavedJobCollectionItem>()
                .HasKey(item => new { item.SavedJobCollectionId, item.SavedJobId });

            // Avoid SQL Server multiple-cascade paths from ApplicationUser through
            // both SavedJob and SavedJobCollection. The collection controller
            // explicitly removes membership rows before deleting a collection.
            modelBuilder.Entity<SavedJobCollectionItem>()
                .HasOne(item => item.Collection)
                .WithMany(collection => collection.Items)
                .HasForeignKey(item => item.SavedJobCollectionId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<SavedJobCollectionItem>()
                .HasOne(item => item.SavedJob)
                .WithMany()
                .HasForeignKey(item => item.SavedJobId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Company>()
                .Property(company => company.Name)
                .HasMaxLength(150)
                .IsRequired();

            modelBuilder.Entity<Company>()
                .Property(company => company.NormalizedName)
                .HasMaxLength(160)
                .IsRequired();

            modelBuilder.Entity<Company>()
                .Property(company => company.Slug)
                .HasMaxLength(180)
                .IsRequired();

            modelBuilder.Entity<Company>()
                .Property(company => company.ApprovalStatus)
                .HasMaxLength(30)
                .HasDefaultValue("Pending")
                .IsRequired();

            modelBuilder.Entity<Company>()
                .HasIndex(company => company.NormalizedName)
                .IsUnique();

            modelBuilder.Entity<Company>()
                .HasIndex(company => company.Slug)
                .IsUnique();

            modelBuilder.Entity<Company>()
                .HasIndex(company => company.OwnerUserId)
                .IsUnique()
                .HasFilter("[OwnerUserId] IS NOT NULL");

            modelBuilder.Entity<Company>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(company => company.OwnerUserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<CandidateJobPreference>()
                .HasIndex(preference => preference.UserId)
                .IsUnique();

            modelBuilder.Entity<CandidateJobPreference>()
                .Property(preference => preference.ExpectedSalary)
                .HasPrecision(18, 2);

            modelBuilder.Entity<CandidateJobPreference>()
                .Property(preference => preference.SalaryCurrency)
                .HasMaxLength(3)
                .HasDefaultValue("INR");

            modelBuilder.Entity<CandidateJobPreference>()
                .Property(preference => preference.SalaryPeriod)
                .HasMaxLength(20)
                .HasDefaultValue("Yearly");

            modelBuilder.Entity<CandidateJobPreference>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(preference => preference.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Notification>()
                .Property(notification => notification.Type)
                .HasMaxLength(40)
                .IsRequired();

            modelBuilder.Entity<Notification>()
                .Property(notification => notification.Title)
                .HasMaxLength(160)
                .IsRequired();

            modelBuilder.Entity<Notification>()
                .Property(notification => notification.Message)
                .HasMaxLength(600)
                .IsRequired();

            modelBuilder.Entity<Notification>()
                .HasIndex(notification => new
                {
                    notification.RecipientUserId,
                    notification.IsRead,
                    notification.CreatedAtUtc
                });

            modelBuilder.Entity<Notification>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(notification => notification.RecipientUserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<NotificationPreference>()
                .HasIndex(preference => preference.UserId)
                .IsUnique();

            modelBuilder.Entity<NotificationPreference>()
                .Property(preference => preference.InAppEnabled)
                .HasDefaultValue(true);

            modelBuilder.Entity<NotificationPreference>()
                .Property(preference => preference.ApplicationInAppEnabled)
                .HasDefaultValue(true);

            modelBuilder.Entity<NotificationPreference>()
                .Property(preference => preference.InterviewInAppEnabled)
                .HasDefaultValue(true);

            modelBuilder.Entity<NotificationPreference>()
                .Property(preference => preference.EmailEnabled)
                .HasDefaultValue(true);

            modelBuilder.Entity<NotificationPreference>()
                .Property(preference => preference.ApplicationEmailEnabled)
                .HasDefaultValue(true);

            modelBuilder.Entity<NotificationPreference>()
                .Property(preference => preference.InterviewEmailEnabled)
                .HasDefaultValue(true);

            modelBuilder.Entity<NotificationPreference>()
                .Property(preference => preference.InterviewReminderEmailEnabled)
                .HasDefaultValue(true);

            modelBuilder.Entity<NotificationPreference>()
                .Property(preference => preference.InterviewReminderInAppEnabled)
                .HasDefaultValue(true);

            modelBuilder.Entity<NotificationPreference>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(preference => preference.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<EmailOutboxMessage>()
                .HasIndex(message => message.DedupeKey)
                .IsUnique();
            modelBuilder.Entity<EmailOutboxMessage>()
                .HasIndex(message => new { message.Status, message.NextAttemptAtUtc });

            modelBuilder.Entity<JobScreeningQuestion>()
                .Property(question => question.QuestionText).HasMaxLength(500).IsRequired();
            modelBuilder.Entity<JobScreeningQuestion>()
                .Property(question => question.QuestionType).HasMaxLength(30).IsRequired();
            modelBuilder.Entity<JobScreeningQuestion>()
                .HasIndex(question => new { question.JobId, question.IsActive, question.SortOrder });
            modelBuilder.Entity<JobScreeningQuestion>()
                .HasOne<Job>()
                .WithMany()
                .HasForeignKey(question => question.JobId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<JobApplicationScreeningAnswer>()
                .HasOne(answer => answer.JobApplication)
                .WithMany(application => application.ScreeningAnswers)
                .HasForeignKey(answer => answer.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<JobApplicationScreeningAnswer>()
                .HasOne(answer => answer.Question)
                .WithMany()
                .HasForeignKey(answer => answer.JobScreeningQuestionId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<JobApplicationScreeningAnswer>()
                .HasIndex(answer => new { answer.JobApplicationId, answer.JobScreeningQuestionId })
                .IsUnique();

            modelBuilder.Entity<Interview>()
                .Property(interview => interview.CandidateResponseStatus)
                .HasMaxLength(30)
                .HasDefaultValue("Pending")
                .IsRequired();

            modelBuilder.Entity<InterviewFeedback>()
                .HasOne(feedback => feedback.Interview)
                .WithMany(interview => interview.FeedbackEntries)
                .HasForeignKey(feedback => feedback.InterviewId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<InterviewFeedback>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(feedback => feedback.SubmittedByUserId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<InterviewFeedback>()
                .HasIndex(feedback => new { feedback.InterviewId, feedback.SubmittedByUserId })
                .IsUnique();
            modelBuilder.Entity<InterviewFeedback>()
                .Property(feedback => feedback.Recommendation)
                .HasMaxLength(30)
                .IsRequired();

            modelBuilder.Entity<InterviewReminderLog>()
                .HasOne<Interview>()
                .WithMany()
                .HasForeignKey(log => log.InterviewId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<InterviewReminderLog>()
                .HasIndex(log => new { log.InterviewId, log.ScheduledAtUtc, log.ReminderMinutes })
                .IsUnique();

            // City/state-only search directory used by the public location autocomplete.
            modelBuilder.Entity<CityLocation>(entity =>
            {
                entity.ToTable("CityLocations");

                entity.Property(city => city.CityName)
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(city => city.StateName)
                    .HasMaxLength(120)
                    .IsRequired();

                entity.Property(city => city.NormalizedCityName)
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(city => city.NormalizedStateName)
                    .HasMaxLength(120)
                    .IsRequired();

                entity.Property(city => city.NormalizedDisplayName)
                    .HasMaxLength(320)
                    .IsRequired();

                entity.Property(city => city.IsActive)
                    .HasDefaultValue(true);

                entity.Property(city => city.LastSyncedAtUtc)
                    .IsRequired();

                entity.HasIndex(city => city.NormalizedDisplayName)
                    .IsUnique();

                entity.HasIndex(city => city.NormalizedCityName);

                entity.HasIndex(city => new
                {
                    city.IsActive,
                    city.NormalizedCityName
                });
            });
        }
    }
}
