using HireFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Data
{
    public class HireFlowDbContext : DbContext
    {
        public HireFlowDbContext(DbContextOptions<HireFlowDbContext> options)
            : base(options)
        {
        }

        public DbSet<Job> Jobs { get; set; }
        public DbSet<JobApplication> JobApplications { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Job>()
                .Property(j => j.Salary)
                .HasPrecision(18, 2);

            base.OnModelCreating(modelBuilder);
        }
    }
}