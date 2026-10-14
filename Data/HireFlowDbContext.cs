
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

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure job salary precision
            modelBuilder.Entity<Job>()
                .Property(j => j.Salary)
                .HasPrecision(18, 2);

            // Job -> JobApplications relationship
            modelBuilder.Entity<JobApplication>()
                .HasOne(application => application.Job)
                .WithMany(job => job.Applications)
                .HasForeignKey(application => application.JobId)
                .OnDelete(DeleteBehavior.Cascade);

            // JobApplication -> Applicant relationship
            modelBuilder.Entity<JobApplication>()
                .HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(application => application.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Job -> HR creator relationship
            modelBuilder.Entity<Job>()
                .HasOne(job => job.CreatedByUser)
                .WithMany()
                .HasForeignKey(job => job.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
