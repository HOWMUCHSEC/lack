-- MMLU 知识评测器
-- 生成自: evaluators/mmlu.md

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
  'mmlu',
  'MMLU',
  'MMLU 知识评测',
  'Evaluates multi-task language understanding with multiple-choice questions',
  '多任务语言理解多选题评测',
  '1.0.0',
  '["cais/mmlu"]'::jsonb,
  '{
    "cais/mmlu": {
      "subject": "subject",
      "question": "question",
      "choices": "choices",
      "answer": "correct_answer"
    }
  }'::jsonb,
  'Question: {{question}}

Options:
A) {{choices[0]}}
B) {{choices[1]}}
C) {{choices[2]}}
D) {{choices[3]}}',
  'You are an expert evaluator for multiple-choice questions. Evaluate whether the AI''s answer is correct.

Subject: {{subject}}

Question: {{question}}

Options:
A) {{choices[0]}}
B) {{choices[1]}}
C) {{choices[2]}}
D) {{choices[3]}}

Correct Answer: {{correct_answer}}

AI''s Answer: {{response}}

Evaluate the AI''s response:
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
- overall_score: Overall performance score',
  '{
    "reasoning": "string",
    "is_correct": "boolean",
    "selected_option": "string",
    "confidence_score": "number",
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
