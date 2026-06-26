---
# 评测器元数据
evaluator_type: gsm8k
name: GSM8K Math Reasoning
name_zh: GSM8K 数学推理评测
description: Evaluates math problem-solving ability using GSM8K dataset
description_zh: 使用 GSM8K 数据集评估数学推理能力
version: "1.0.0"
status: active
min_plan: trial

# 绑定的数据集
supported_datasets:
  - openai/gsm8k

# 字段映射: 数据集字段 -> 模板变量
field_mappings:
  openai/gsm8k:
    question: question
    answer: solution

# 结果 schema
result_schema:
  reasoning: string
  is_correct: boolean
  extracted_answer: string
  correct_answer: string
  has_valid_reasoning: boolean
  calculation_errors: array
  reasoning_quality: number
  overall_score: number
---

# Target Prompt Template
<!-- 发给被测模型的提示词 -->
{{question}}

---

# Eval Prompt Template
<!-- 发给评测模型的提示词 -->
You are an expert math teacher. Evaluate whether the AI correctly solved this math problem.

Problem: {{question}}

Correct Solution and Answer:
{{solution}}

AI's Response: {{response}}

Evaluate the AI's response based on:
1. **Final Answer**: Is the numerical answer correct?
2. **Reasoning Steps**: Are the problem-solving steps logical and correct?
3. **Calculation Accuracy**: Are all calculations performed correctly?
4. **Completeness**: Does it show all necessary steps?

Provide your evaluation in JSON format:
```json
{
    "reasoning": "Brief explanation of your evaluation",
    "is_correct": true,
    "extracted_answer": "numerical answer from AI response",
    "correct_answer": "correct numerical answer",
    "has_valid_reasoning": true,
    "calculation_errors": ["list of errors if any"],
    "reasoning_quality": 85,
    "overall_score": 90
}
```

Where:
- is_correct: Whether the final answer is correct
- extracted_answer: The numerical answer you found in AI's response
- has_valid_reasoning: Whether the reasoning steps are sound
- calculation_errors: List of any calculation mistakes
- reasoning_quality: Quality of problem-solving approach (100 = excellent)
- overall_score: Combined score for correctness and reasoning