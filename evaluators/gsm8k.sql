-- GSM8K 数学推理评测器
-- 生成自: evaluators/gsm8k.md

INSERT INTO public.evaluator_templates (
  evaluator_type,
  name,
  name_zh,
  description,
  description_zh,
  version,
  supported_datasets,
  field_mappings,
  target_prompt_template,
  eval_prompt_template,
  result_schema,
  status,
  min_plan
) VALUES (
  'gsm8k',
  'GSM8K Math Reasoning',
  'GSM8K 数学推理评测',
  'Evaluates math problem-solving ability using GSM8K dataset',
  '使用 GSM8K 数据集评估数学推理能力',
  '1.0.0',
  '["openai/gsm8k"]'::jsonb,
  '{
    "openai/gsm8k": {
      "question": "question",
      "answer": "solution"
    }
  }'::jsonb,
  '{{question}}',
  'You are an expert math teacher. Evaluate whether the AI correctly solved this math problem.

Problem: {{question}}

Correct Solution and Answer:
{{solution}}

AI''s Response: {{response}}

Evaluate the AI''s response based on:
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
- extracted_answer: The numerical answer you found in AI''s response
- has_valid_reasoning: Whether the reasoning steps are sound
- calculation_errors: List of any calculation mistakes
- reasoning_quality: Quality of problem-solving approach (100 = excellent)
- overall_score: Combined score for correctness and reasoning',
  '{
    "reasoning": "string",
    "is_correct": "boolean",
    "extracted_answer": "string",
    "correct_answer": "string",
    "has_valid_reasoning": "boolean",
    "calculation_errors": "array",
    "reasoning_quality": "number",
    "overall_score": "number"
  }'::jsonb,
  'active',
  'trial'
)
ON CONFLICT (evaluator_type, version) 
DO UPDATE SET
  name = EXCLUDED.name,
  name_zh = EXCLUDED.name_zh,
  description = EXCLUDED.description,
  description_zh = EXCLUDED.description_zh,
  supported_datasets = EXCLUDED.supported_datasets,
  field_mappings = EXCLUDED.field_mappings,
  target_prompt_template = EXCLUDED.target_prompt_template,
  eval_prompt_template = EXCLUDED.eval_prompt_template,
  result_schema = EXCLUDED.result_schema,
  status = EXCLUDED.status,
  min_plan = EXCLUDED.min_plan,
  updated_at = now();
