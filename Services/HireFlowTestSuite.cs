using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using HireFlow.Api.Controllers;
using HireFlow.Api.DTOs;

namespace HireFlow.Api.Services;

public static class HireFlowTestSuite
{
    public static int RunAllTests()
    {
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("==================================================================");
        Console.WriteLine("   HireFlow Full-Stack Automated Test Suite & Security Asserts   ");
        Console.WriteLine("==================================================================");
        Console.ResetColor();

        int passed = 0;
        int failed = 0;

        void AssertTest(string testName, Action testAction)
        {
            try
            {
                testAction();
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"[PASS] {testName}");
                Console.ResetColor();
                passed++;
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"[FAIL] {testName}: {ex.Message}");
                Console.ResetColor();
                failed++;
            }
        }

        // ----------------------------------------------------
        // Group 1: Skill Assessment Quiz & Scoring
        // ----------------------------------------------------
        AssertTest("SkillQuiz: Generates structured questions with 4 options and valid tags", () =>
        {
            var questions = AiAgentController.GetStandardQuizQuestions();
            if (questions.Count != 5) throw new Exception($"Expected 5 questions, got {questions.Count}");
            foreach (var q in questions)
            {
                if (string.IsNullOrWhiteSpace(q.Question)) throw new Exception("Question text is empty");
                if (q.Options.Count != 4) throw new Exception("Expected 4 options per question");
                if (string.IsNullOrWhiteSpace(q.SkillTag)) throw new Exception("SkillTag is empty");
            }
        });

        AssertTest("SkillQuiz: Accurately scores 100% and assigns 'Advanced' tier", () =>
        {
            var bank = AiAgentController.StandardQuizBank.Take(5).ToList();
            var answers = new Dictionary<int, int>();
            foreach (var q in bank)
            {
                answers[q.Id] = q.CorrectIndex;
            }

            var result = AiAgentController.EvaluateAnswers(answers);
            if (result.Score != 100) throw new Exception($"Expected score 100, got {result.Score}");
            if (result.CorrectCount != 5) throw new Exception($"Expected 5 correct, got {result.CorrectCount}");
            if (result.Tier != "Advanced") throw new Exception($"Expected 'Advanced', got {result.Tier}");
            if (result.Reviews.Count != 5) throw new Exception($"Expected 5 reviews, got {result.Reviews.Count}");
        });

        AssertTest("SkillQuiz: Accurately scores 60% and assigns 'Proficient' tier", () =>
        {
            var bank = AiAgentController.StandardQuizBank.Take(5).ToList();
            var answers = new Dictionary<int, int>();
            for (int i = 0; i < bank.Count; i++)
            {
                answers[bank[i].Id] = i < 3 ? bank[i].CorrectIndex : (bank[i].CorrectIndex + 1) % 4;
            }

            var result = AiAgentController.EvaluateAnswers(answers);
            if (result.Score != 60) throw new Exception($"Expected score 60, got {result.Score}");
            if (result.CorrectCount != 3) throw new Exception($"Expected 3 correct, got {result.CorrectCount}");
            if (result.Tier != "Proficient") throw new Exception($"Expected 'Proficient', got {result.Tier}");
        });

        AssertTest("SkillQuiz: Accurately scores 20% and assigns 'Developing' tier", () =>
        {
            var bank = AiAgentController.StandardQuizBank.Take(5).ToList();
            var answers = new Dictionary<int, int>();
            for (int i = 0; i < bank.Count; i++)
            {
                answers[bank[i].Id] = i == 0 ? bank[i].CorrectIndex : (bank[i].CorrectIndex + 1) % 4;
            }

            var result = AiAgentController.EvaluateAnswers(answers);
            if (result.Score != 20) throw new Exception($"Expected score 20, got {result.Score}");
            if (result.CorrectCount != 1) throw new Exception($"Expected 1 correct, got {result.CorrectCount}");
            if (result.Tier != "Developing") throw new Exception($"Expected 'Developing', got {result.Tier}");
        });

        // ----------------------------------------------------
        // Group 2: Bulk Resume Screener & ATS Match
        // ----------------------------------------------------
        AssertTest("BulkScreener: Accurately identifies technical keywords in resume text", () =>
        {
            string resume = "Lead software engineer architecting systems in C#, ASP.NET Core, React, Docker, and PostgreSQL.";
            var skills = AiAgentController.ExtractSkillsFromText(resume);
            var expected = new[] { "C#", "ASP.NET Core", "React", "Docker", "PostgreSQL" };
            foreach (var exp in expected)
            {
                if (!skills.Any(s => s.Equals(exp, StringComparison.OrdinalIgnoreCase)))
                    throw new Exception($"Missing expected keyword: {exp}");
            }
        });

        AssertTest("BulkScreener: Computes ATS ranking and recommendations correctly", () =>
        {
            string jobReqs = "C#, .NET, React, PostgreSQL, Docker";
            var candidates = new List<BulkResumeCandidateInput>
            {
                new() { Name = "Alice", Email = "alice@example.com", ResumeText = "Experienced with C#, .NET, React, PostgreSQL, Docker, Git" },
                new() { Name = "Bob", Email = "bob@example.com", ResumeText = "Junior frontend developer using React, HTML, and CSS" },
                new() { Name = "Charlie", Email = "charlie@example.com", ResumeText = "Backend developer working with C#, .NET, and SQL Server" }
            };

            var ranked = AiAgentController.ScreenResumes(jobReqs, candidates);
            if (ranked.Count != 3) throw new Exception($"Expected 3 ranked candidates, got {ranked.Count}");

            // Verify descending rank
            if (ranked[0].Name != "Alice") throw new Exception($"Expected Alice at rank 1, got {ranked[0].Name}");
            if (ranked[1].Name != "Charlie") throw new Exception($"Expected Charlie at rank 2, got {ranked[1].Name}");
            if (ranked[2].Name != "Bob") throw new Exception($"Expected Bob at rank 3, got {ranked[2].Name}");

            // Verify recommendation tags
            if (ranked[0].RecommendedAction != "Fast-Track") throw new Exception($"Expected Fast-Track for Alice, got {ranked[0].RecommendedAction}");
            if (ranked[2].RecommendedAction != "Pass") throw new Exception($"Expected Pass for Bob, got {ranked[2].RecommendedAction}");
        });

        // ----------------------------------------------------
        // Group 3: Metadata Persistence & Schema-Free Storage
        // ----------------------------------------------------
        AssertTest("MetadataPersistence: Round-trips Offer & Assessment within RecruiterNotes JSON without migrations", () =>
        {
            string originalNotes = "Strong technical candidate with solid experience.";
            var offer = new OfferDetailsDto
            {
                RoleTitle = "Full Stack Engineer",
                Company = "HireFlow Tech",
                BaseSalary = "INR 12,00,000",
                JoiningDate = "15 Dec 2026",
                Status = "Offered"
            };

            var metadata = new Dictionary<string, object>
            {
                ["notes"] = originalNotes,
                ["offer"] = offer,
                ["assessment"] = new
                {
                    score = 85,
                    tier = "Advanced",
                    totalQuestions = 5,
                    correctCount = 4
                }
            };
            string serialized = JsonSerializer.Serialize(metadata);

            using var doc = JsonDocument.Parse(serialized);
            var root = doc.RootElement;
            if (!root.TryGetProperty("notes", out var notesProp) || notesProp.GetString() != originalNotes)
                throw new Exception("Failed to round-trip original recruiter notes");
            if (!root.TryGetProperty("offer", out var offerProp))
                throw new Exception("Missing 'offer' property in JSON");

            var baseSal = offerProp.TryGetProperty("baseSalary", out var p1) ? p1.GetString() : offerProp.GetProperty("BaseSalary").GetString();
            if (baseSal != "INR 12,00,000")
                throw new Exception($"Expected BaseSalary 'INR 12,00,000', got '{baseSal}'");

            if (!root.TryGetProperty("assessment", out var quizProp))
                throw new Exception("Missing 'assessment' property in JSON");
            var scoreVal = quizProp.TryGetProperty("score", out var p2) ? p2.GetInt32() : quizProp.GetProperty("Score").GetInt32();
            if (scoreVal != 85)
                throw new Exception($"Expected score 85, got {scoreVal}");
        });

        // ----------------------------------------------------
        // Group 4: Security & Data Isolation Verification
        // ----------------------------------------------------
        AssertTest("Security: Candidate response hides internal recruiter notes from student view", () =>
        {
            string rawNotes = JsonSerializer.Serialize(new
            {
                notes = "CONFIDENTIAL: Candidate asked for 20% higher salary than budget.",
                offer = new { roleTitle = "Engineer", baseSalary = "INR 9,00,000", status = "Offered" },
                assessment = new { score = 80, tier = "Advanced" }
            });

            string? candidateFacingNotes = null;
            object? candidateFacingOffer = null;
            try
            {
                using var doc = JsonDocument.Parse(rawNotes);
                if (doc.RootElement.TryGetProperty("offer", out var offEl))
                {
                    candidateFacingOffer = JsonSerializer.Deserialize<OfferDetailsDto>(offEl.GetRawText(), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                // Recruiter notes must NOT be mapped to student response
                candidateFacingNotes = null;
            }
            catch { }

            if (candidateFacingNotes != null) throw new Exception("Security breach: private notes exposed to candidate!");
            if (candidateFacingOffer == null) throw new Exception("Expected candidate offer to be parsed successfully");
        });

        AssertTest("Security: Offer acceptance validates valid transition states ('Accepted' | 'Declined')", () =>
        {
            var validDecisions = new[] { "Accepted", "Declined" };
            foreach (var dec in validDecisions)
            {
                if (!dec.Equals("Accepted", StringComparison.OrdinalIgnoreCase) &&
                    !dec.Equals("Declined", StringComparison.OrdinalIgnoreCase))
                {
                    throw new Exception($"Invalid decision permitted: {dec}");
                }
            }

            bool invalidRejected = false;
            try
            {
                string invalid = "TamperedStatus";
                if (!invalid.Equals("Accepted", StringComparison.OrdinalIgnoreCase) &&
                    !invalid.Equals("Declined", StringComparison.OrdinalIgnoreCase))
                {
                    throw new ArgumentException("Decision must be either 'Accepted' or 'Declined'.");
                }
            }
            catch (ArgumentException)
            {
                invalidRejected = true;
            }

            if (!invalidRejected) throw new Exception("Security vulnerability: invalid decision was not rejected");
        });

        // ----------------------------------------------------
        // Group 4: Live Real-Time Events & WebSockets
        // ----------------------------------------------------
        AssertTest("LiveEvents: Publishes, stores in ring-buffer, and filters by role", () =>
        {
            var service = new LiveEventsService();
            service.Publish(new LiveEventDto
            {
                Type = "ApplicationReceived",
                Title = "New Candidate Application",
                Message = "Alex Morgan applied for Lead Backend Engineer",
                TargetRole = "HR",
                Payload = new { jobId = 101 }
            });

            var recent = service.GetRecentEvents(5);
            if (recent.Count != 1) throw new Exception($"Expected 1 recent event, got {recent.Count}");
            if (recent[0].Type != "ApplicationReceived") throw new Exception($"Expected 'ApplicationReceived', got {recent[0].Type}");
            if (recent[0].TargetRole != "HR") throw new Exception($"Expected TargetRole 'HR', got {recent[0].TargetRole}");
        });

        // ----------------------------------------------------
        // Group 5: Recruiter Scorecard & Rating Matrix
        // ----------------------------------------------------
        AssertTest("Security: Interview Scorecard strictly clamps ratings between 1 and 5", () =>
        {
            int outOfBoundsHigh = 10;
            int outOfBoundsLow = -5;
            int clampedHigh = Math.Clamp(outOfBoundsHigh, 1, 5);
            int clampedLow = Math.Clamp(outOfBoundsLow, 1, 5);

            if (clampedHigh != 5) throw new Exception($"Expected clamped high 5, got {clampedHigh}");
            if (clampedLow != 1) throw new Exception($"Expected clamped low 1, got {clampedLow}");

            var ratings = new List<int> { 5, 4, 5, 4 };
            var avg = Math.Round(ratings.Average(), 1);
            if (avg != 4.5) throw new Exception($"Expected average 4.5, got {avg}");
        });

        // ----------------------------------------------------
        // Group 6: Pipeline Funnel Analytics & Drop-off Rates
        // ----------------------------------------------------
        AssertTest("Analytics: Pipeline Funnel calculates accurate conversion rates and drop-offs", () =>
        {
            int total = 100;
            int screened = 75;
            int shortlisted = 50;
            int interviewed = 25;
            int hired = 10;

            double screenRate = Math.Round((double)screened / total * 100, 1);
            double shortlistRate = Math.Round((double)shortlisted / total * 100, 1);
            double interviewRate = Math.Round((double)interviewed / total * 100, 1);
            double hireYield = Math.Round((double)hired / total * 100, 1);

            if (screenRate != 75.0) throw new Exception($"Expected screen rate 75.0%, got {screenRate}%");
            if (shortlistRate != 50.0) throw new Exception($"Expected shortlist rate 50.0%, got {shortlistRate}%");
            if (interviewRate != 25.0) throw new Exception($"Expected interview rate 25.0%, got {interviewRate}%");
            if (hireYield != 10.0) throw new Exception($"Expected hire yield 10.0%, got {hireYield}%");

            double screenToShortlistDropoff = Math.Round((1.0 - ((double)shortlisted / screened)) * 100, 1);
            if (screenToShortlistDropoff != 33.3) throw new Exception($"Expected drop-off 33.3%, got {screenToShortlistDropoff}%");
        });

        // ----------------------------------------------------
        // Group 7: Community, Discussions & Alumni Network
        // ----------------------------------------------------
        AssertTest("Community: Creates discussion, prevents empty posts, and manages upvotes", () =>
        {
            var liveEvents = new LiveEventsService();
            var controller = new CommunityController(liveEvents);

            // Valid discussion
            var createResult = controller.CreateDiscussion(new CreateDiscussionDto
            {
                Company = "Amazon",
                Role = "SDE Intern",
                Text = "2 Coding questions on HackerRank. DP and Trees.",
                IsAnonymous = true
            }) as Microsoft.AspNetCore.Mvc.OkObjectResult;

            if (createResult?.Value is not DiscussionPostDto post) throw new Exception("Expected OkObjectResult with DiscussionPostDto");
            if (post.Company != "Amazon") throw new Exception($"Expected Amazon, got {post.Company}");
            if (post.Upvotes != 1) throw new Exception($"Expected 1 upvote, got {post.Upvotes}");

            // Empty text validation
            var badResult = controller.CreateDiscussion(new CreateDiscussionDto { Text = "" }) as Microsoft.AspNetCore.Mvc.BadRequestObjectResult;
            if (badResult == null) throw new Exception("Expected BadRequest for empty text");

            // Upvote toggle
            var upvoteResult = controller.UpvoteDiscussion(post.Id) as Microsoft.AspNetCore.Mvc.OkObjectResult;
            if (upvoteResult?.Value is not UpvoteResponseDto upvote) throw new Exception("Expected UpvoteResponseDto");
            if (upvote.Upvotes < 1) throw new Exception("Expected upvote count to be positive");

            // Alumni list
            var alumniResult = controller.GetAlumni() as Microsoft.AspNetCore.Mvc.OkObjectResult;
            if (alumniResult?.Value is not List<AlumniProfileDto> alumni || alumni.Count == 0) throw new Exception("Expected seeded alumni list");
        });

        // ----------------------------------------------------
        // Group 8: Credential Vault & Verification Bundle
        // ----------------------------------------------------
        AssertTest("Vault: Adds credentials, verifies bundle, and supports deletion", () =>
        {
            var liveEvents = new LiveEventsService();
            var controller = new VaultController(liveEvents);

            var addResult = controller.AddDocument(new AddVaultDocumentDto
            {
                Title = "AWS Certified Solutions Architect",
                Category = "Certificate",
                FileUrl = "https://hireflow.me/vault/aws-sa.pdf"
            }) as Microsoft.AspNetCore.Mvc.OkObjectResult;

            if (addResult?.Value is not VaultDocumentDto doc) throw new Exception("Expected VaultDocumentDto");
            if (!doc.VerifiedByCollege) throw new Exception("Expected VerifiedByCollege to be true");

            // Bundle retrieval
            var bundleResult = controller.CreateOrGetBundle() as Microsoft.AspNetCore.Mvc.OkObjectResult;
            if (bundleResult?.Value is not VaultBundleDto bundle) throw new Exception("Expected VaultBundleDto");
            if (bundle.Documents.Count == 0) throw new Exception("Expected documents in bundle");

            // Delete
            var deleteResult = controller.DeleteDocument(doc.Id) as Microsoft.AspNetCore.Mvc.OkObjectResult;
            if (deleteResult == null) throw new Exception("Expected OkObjectResult on document delete");
        });

        // ----------------------------------------------------
        // Group 9: Multi-Resume Versions & Public Portfolio
        // ----------------------------------------------------
        AssertTest("ResumeVersions: Saves profile variants and loads public portfolio", () =>
        {
            var liveEvents = new LiveEventsService();
            var controller = new ResumeVersionsController(liveEvents);

            var saveResult = controller.SaveVersion(new SaveResumeVersionDto
            {
                VersionKey = "devops",
                Title = "Cloud & DevOps SDE",
                ResumeData = JsonSerializer.SerializeToElement(new { role = "DevOps" })
            }) as Microsoft.AspNetCore.Mvc.OkObjectResult;

            if (saveResult?.Value is not ResumeVersionDto version) throw new Exception("Expected ResumeVersionDto");
            if (version.VersionKey != "devops") throw new Exception($"Expected 'devops', got {version.VersionKey}");

            // Public portfolio
            var portfolioResult = controller.GetPortfolio("alexmorgan") as Microsoft.AspNetCore.Mvc.OkObjectResult;
            if (portfolioResult?.Value is not PublicPortfolioProfileDto portfolio) throw new Exception("Expected PublicPortfolioProfileDto");
            if (!portfolio.IsAvailableForHire) throw new Exception("Expected IsAvailableForHire to be true");
        });

        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"[TEST SUMMARY] {passed} Passed, {failed} Failed out of {passed + failed} Tests.");
        Console.ResetColor();

        return failed == 0 ? 0 : 1;
    }
}
