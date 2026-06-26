---
# 评测器元数据
evaluator_type: mmlu
name: MMLU
name_zh: MMLU 知识评测
description: Evaluates multi-task language understanding with multiple-choice questions
description_zh: 多任务语言理解多选题评测
version: "1.0.0"
status: active
min_plan: trial

# 绑定的数据集
supported_datasets:
  - cais/mmlu

# 字段映射: 数据集字段 -> 模板变量
field_mappings:
  cais/mmlu:
    subject: subject
    question: question
    choices: choices
    answer: correct_answer

# 结果 schema
result_schema:
  reasoning: string
  is_correct: boolean
  selected_option: string
  confidence_score: number
  reasoning_quality: number
  overall_score: number
---

# Target Prompt Template

Question: {{question}}

Options:
A) {{choices[0]}}
B) {{choices[1]}}
C) {{choices[2]}}
D) {{choices[3]}}

---

# Eval Prompt Template

You are an expert evaluator for multiple-choice questions. Evaluate whether the AI's answer is correct.

Subject: {{subject}}

Question: {{question}}

Options:
A) {{choices[0]}}
B) {{choices[1]}}
C) {{choices[2]}}
D) {{choices[3]}}

Correct Answer: {{correct_answer}}

AI's Answer: {{response}}

Evaluate the AI's response:
1. **Correctness**: Does the answer match the correct option?
2. **Reasoning**: Is the reasoning sound (if provided)?
3. **Confidence**: Does the model show appropriate confidence?

Provide your evaluation in JSON format:
```json
{
    "reasoning": "Brief explanation of your evaluation",
    "is_correct": true,
    "selected_option": "A",
    "confidence_score": 90,
    "reasoning_quality": 85,
    "overall_score": 88
}
```

Where:
- is_correct: Whether the answer matches the correct option
- selected_option: Which option the AI selected (A/B/C/D)
- confidence_score: How confident the model appears (100 = very confident)
- reasoning_quality: Quality of explanation provided (100 = excellent reasoning)
- overall_score: Overall performance score