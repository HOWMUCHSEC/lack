---
# 评测器元数据
evaluator_type: humaneval
name: HumanEval
name_zh: 代码生成评测
description: Evaluates code generation quality using HumanEval benchmark
description_zh: 使用 HumanEval 基准评估代码生成质量
version: "1.0.0"
status: active
min_plan: trial

# 绑定的数据集
supported_datasets:
  - openai/openai_humaneval

# 字段映射: 数据集字段 -> 模板变量
field_mappings:
  openai/openai_humaneval:
    prompt: prompt
    canonical_solution: canonical_solution
    test: test
    entry_point: entry_point

# 结果 schema
result_schema:
  reasoning: string
  is_correct: boolean
  passes_tests: boolean
  code_quality: number
  efficiency: number
  completeness: number
  issues: array
  overall_score: number
---

# Target Prompt Template

{{prompt}}

---

# Eval Prompt Template

You are an expert code reviewer. Evaluate the quality and correctness of the generated Python code.

Task Description:
{{prompt}}

Expected Functionality:
{{canonical_solution}}

AI's Generated Code:
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
- overall_score: Combined score for the solution