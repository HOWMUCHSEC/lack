-- HumanEval 代码生成评测器
-- 生成自: evaluators/humaneval.md

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
  'humaneval',
  'HumanEval',
  '代码生成评测',
  'Evaluates code generation quality using HumanEval benchmark',
  '使用 HumanEval 基准评估代码生成质量',
  '1.0.0',
  '["openai/openai_humaneval"]'::jsonb,
  '{
    "openai/openai_humaneval": {
      "prompt": "prompt",
      "canonical_solution": "canonical_solution",
      "test": "test",
      "entry_point": "entry_point"
    }
  }'::jsonb,
  '{{prompt}}',
  'You are an expert code reviewer. Evaluate the quality and correctness of the generated Python code.

Task Description:
{{prompt}}

Expected Functionality:
{{canonical_solution}}

AI''s Generated Code:
{{response}}

Test Cases (for reference):
{{test}}

Evaluate the code based on:
1. **Correctness**: Does it solve the problem correctly?
2. **Code Quality**: Is it clean, readable, and well-structured?
3. **Efficiency**: Is the solution reasonably efficient?
4. **Completeness**: Does it handle edge cases?

Provide your evaluation in JSON format:
```json
{
    "reasoning": "Brief explanation of your evaluation",
    "is_correct": true,
    "passes_tests": true,
    "code_quality": 85,
    "efficiency": 80,
    "completeness": 90,
    "issues": [],
    "overall_score": 85
}
```

Where:
- is_correct: Whether the code solves the problem correctly
- passes_tests: Whether it would pass the test cases
- code_quality: Code readability and structure (100 = excellent)
- efficiency: Algorithm efficiency (100 = optimal)
- completeness: Handles all cases and edge cases (100 = complete)
- overall_score: Combined score for the solution',
  '{
    "reasoning": "string",
    "is_correct": "boolean",
    "passes_tests": "boolean",
    "code_quality": "number",
    "efficiency": "number",
    "completeness": "number",
    "issues": "array",
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
