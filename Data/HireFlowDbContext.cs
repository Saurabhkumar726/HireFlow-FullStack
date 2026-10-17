using HireFlow.Api.Authentication;
using HireFlow.Api.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Data
{
    public class HireFlowDbContext : IdentityDbContext<ApplicationUser>
    {
        public HireFlowDbContext(
            DbContextOptions<HireFlowDbContext> options)
            : base(options)
        {
        }

        public DbSet<Job> Jobs { get; set; }

        public DbSet<JobApplication> JobApplications { get; set; }

        public DbSet<PasswordResetOtp> PasswordResetOtps { get; set; }

        // Candidate profile sections
        public DbSet<CandidateEmployment> CandidateEmployments { get; set; }

        public DbSet<CandidateEducation> CandidateEducations { get; set; }

        public DbSet<CandidateProject> CandidateProjects { get; set; }

        public DbSet<CandidateSkill> CandidateSkills { get; set; }

        public DbSet<CandidateAccomplishment> CandidateAccomplishments { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Google account identifier: unique when present.
            modelBuilder.Entity<ApplicationUser>()
                .HasIndex(user => user.GoogleSubject)
                .IsUnique()
                .HasFilter("[GoogleSubject] IS NOT NULL");

            // Job salary precision
            modelBuilder.Entity<Job>()
                .Property(job => job.Salary)
                .HasPrecision(18, 2);

            // Candidate expected salary precision
            modelBuilder.Entity<ApplicationUser>()
                .Property(user => user.ExpectedSalary)
                .HasPrecision(18, 2);

            // Candidate education grade precision
            modelBuilder.Entity<CandidateEducation>()
                .Property(education => education.Grade)
                .HasPrecision(5, 2);

            // Job -> JobApplications
            modelBuilder.Entity<JobApplication>()
                .HasOne(application => application.Job)
                .WithMany(job => job.Applications)
                .HasForeignKey(application => application.JobId)
                .OnDelete(DeleteBehavior.Cascade);

            // JobApplication -> Applicant
            modelBuilder.Entity<JobApplication>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(application => application.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Job -> HR creator
            modelBuilder.Entity<Job>()
                .HasOne(job => job.CreatedByUser)
                .WithMany()
                .HasForeignKey(job => job.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Password reset OTP index
            modelBuilder.Entity<PasswordResetOtp>()
                .HasIndex(otp => new { otp.UserId, otp.CreatedAt });

            // Prevent duplicate skills within the same category for each user
            modelBuilder.Entity<CandidateSkill>()
                .HasIndex(skill => new
                {
                    skill.UserId,
                    skill.Category,
                    skill.SkillName
                })
                .IsUnique();

            // Candidate profile indexes
            modelBuilder.Entity<CandidateEmployment>()
                .HasIndex(employment => employment.UserId);

            modelBuilder.Entity<CandidateEducation>()
                .HasIndex(education => education.UserId);

            modelBuilder.Entity<CandidateProject>()
                .HasIndex(project => project.UserId);

            modelBuilder.Entity<CandidateAccomplishment>()
                .HasIndex(accomplishment => accomplishment.UserId);
        }
    }
}