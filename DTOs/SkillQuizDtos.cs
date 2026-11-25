using System.ComponentModel.DataAnnotations;

namespace HireFlow.Api.DTOs
{
    public class SkillQuizQuestionDto
    {
        public int Id { get; set; }
        public string Question { get; set; } = string.Empty;
        public List<string> Options { get; set; } = new();
        public string? SkillTag { get; set; }
        public string? Explanation { get; set; }
    }

    public class GenerateSkillQuizRequest
    {
        public int? JobId { get; set; }
        public string? Topic { get; set; }
        public List<string>? Skills { get; set; }
    }

    public class SkillQuizSubmitRequest
    {
        public int? JobId { get; set; }
        public int? ApplicationId { get; set; }
        public Dictionary<int, int> SelectedAnswers { get; set; } = new(); // QuestionId -> OptionIndex (0-3)
    }

    public class QuizQuestionReviewDto
    {
        public int QuestionId { get; set; }
        public string Question { get; set; } = string.Empty;
        public int SelectedOptionIndex { get; set; }
        public int CorrectOptionIndex { get; set; }
        public bool IsCorrect { get; set; }
        public string Explanation { get; set; } = string.Empty;
    }

    public class SkillQuizResultDto
    {
        public int Score { get; set; } // 0 - 100
        public int CorrectCount { get; set; }
        public int TotalQuestions { get; set; }
        public string Tier { get; set; } = "Proficient"; // "Advanced", "Proficient", "Developing"
        public string Feedback { get; set; } = string.Empty;
        public List<QuizQuestionReviewDto> Reviews { get; set; } = new();
    }
}
