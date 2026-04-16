---
name: data-analysis
description: 当用户上传 Excel（.xlsx/.xls）或 CSV 文件并希望进行数据分析、统计、摘要、透视、SQL 查询或结构化数据探索时使用。支持多工作表 Excel、聚合、筛选、关联，并可导出为 CSV/JSON/Markdown。
---

# 数据分析技能

## 概览

该技能通过 DuckDB（嵌入式分析型 SQL 引擎）分析用户上传的 Excel/CSV 文件。支持结构检查、SQL 查询、统计汇总与结果导出，均通过一个 Python 脚本完成。

## 核心能力

- 检查 Excel/CSV 结构（工作表、列、类型、行数）
- 对上传数据执行任意 SQL 查询
- 生成统计摘要（均值、中位数、标准差、分位数、空值）
- 支持多工作表 Excel（每个工作表映射为一张表）
- 将查询结果导出为 CSV、JSON 或 Markdown
- 依托 DuckDB 列式引擎高效处理大文件

## 工作流

### 步骤 1：明确需求

用户上传数据并提出分析需求后，识别：

- **文件位置**：`/mnt/user-data/uploads/` 下上传文件路径
- **分析目标**：期望洞察（汇总、筛选、聚合、对比等）
- **输出格式**：结果展示方式（表格、CSV 导出、JSON 等）
- 不需要检查 `/mnt/user-data` 文件夹

### 步骤 2：检查文件结构

先检查上传文件的 schema：

```bash
python /mnt/skills/public/data-analysis/scripts/analyze.py   --files /mnt/user-data/uploads/data.xlsx   --action inspect
```

返回内容包括：
- Excel 的工作表名（或 CSV 的文件名）
- 列名、数据类型、非空计数
- 每个工作表/文件的行数
- 样例数据（前 5 行）

### 步骤 3：执行分析

基于 schema，构造 SQL 回答用户问题。

#### 执行 SQL 查询

```bash
python /mnt/skills/public/data-analysis/scripts/analyze.py   --files /mnt/user-data/uploads/data.xlsx   --action query   --sql "SELECT category, COUNT(*) as count, AVG(amount) as avg_amount FROM Sheet1 GROUP BY category ORDER BY count DESC"
```

#### 生成统计摘要

```bash
python /mnt/skills/public/data-analysis/scripts/analyze.py   --files /mnt/user-data/uploads/data.xlsx   --action summary   --table Sheet1
```

数值列返回：count、mean、std、min、25%、50%、75%、max、null_count。  
字符串列返回：count、unique、top value、frequency、null_count。

#### 导出结果

```bash
python /mnt/skills/public/data-analysis/scripts/analyze.py   --files /mnt/user-data/uploads/data.xlsx   --action query   --sql "SELECT * FROM Sheet1 WHERE amount > 1000"   --output-file /mnt/user-data/outputs/filtered-results.csv
```

支持导出格式（根据扩展名自动识别）：
- `.csv`：逗号分隔值
- `.json`：JSON 记录数组
- `.md`：Markdown 表格

### 参数

| 参数 | 必填 | 说明 |
|-----------|----------|-------------|
| `--files` | 是 | Excel/CSV 文件路径（空格分隔） |
| `--action` | 是 | `inspect`、`query`、`summary` 之一 |
| `--sql` | `query` 时必填 | 要执行的 SQL |
| `--table` | `summary` 时必填 | 需要汇总的表/工作表名称 |
| `--output-file` | 否 | 导出结果路径（CSV/JSON/MD） |

> [!NOTE]
> 不要读取 Python 脚本内容，直接按参数调用。

## 表命名规则

- **Excel 文件**：每个工作表映射为同名表（如 `Sheet1`、`Sales`、`Revenue`）
- **CSV 文件**：表名为去扩展名后的文件名（如 `data.csv` → `data`）
- **多文件**：所有表共享同一查询上下文，支持跨文件关联
- **特殊字符**：含空格或特殊字符的名称会自动清洗（空格转下划线）。名称以数字开头或含特殊字符时，请使用双引号，如 `"2024_Sales"`

## 分析模式

### 基础探索
```sql
-- 行数
SELECT COUNT(*) FROM Sheet1

-- 列中的去重值
SELECT DISTINCT category FROM Sheet1

-- 值分布
SELECT category, COUNT(*) as cnt FROM Sheet1 GROUP BY category ORDER BY cnt DESC

-- 日期范围
SELECT MIN(date_col), MAX(date_col) FROM Sheet1
```

### 聚合与分组
```sql
-- 按分类与月份统计收入
SELECT category, DATE_TRUNC('month', order_date) as month,
       SUM(revenue) as total_revenue
FROM Sales
GROUP BY category, month
ORDER BY month, total_revenue DESC

-- 按消费额排序的前 10 客户
SELECT customer_name, SUM(amount) as total_spend
FROM Orders GROUP BY customer_name
ORDER BY total_spend DESC LIMIT 10
```

### 跨文件关联
```sql
-- 关联不同文件中的销售和客户信息
SELECT s.order_id, s.amount, c.customer_name, c.region
FROM sales s
JOIN customers c ON s.customer_id = c.id
WHERE s.amount > 500
```

### 窗口函数
```sql
-- 累计值与排名
SELECT order_date, amount,
       SUM(amount) OVER (ORDER BY order_date) as running_total,
       RANK() OVER (ORDER BY amount DESC) as amount_rank
FROM Sales
```

### 类透视分析
```sql
-- 透视：按分类统计月度收入
SELECT category,
       SUM(CASE WHEN MONTH(date) = 1 THEN revenue END) as Jan,
       SUM(CASE WHEN MONTH(date) = 2 THEN revenue END) as Feb,
       SUM(CASE WHEN MONTH(date) = 3 THEN revenue END) as Mar
FROM Sales
GROUP BY category
```

## 完整示例

用户上传 `sales_2024.xlsx`（工作表：`Orders`、`Products`、`Customers`），并提出："分析销售数据，展示按收入排序的热门产品和月度趋势。"

### 步骤 1：检查文件

```bash
python /mnt/skills/public/data-analysis/scripts/analyze.py   --files /mnt/user-data/uploads/sales_2024.xlsx   --action inspect
```

### 步骤 2：按收入统计热门产品

```bash
python /mnt/skills/public/data-analysis/scripts/analyze.py   --files /mnt/user-data/uploads/sales_2024.xlsx   --action query   --sql "SELECT p.product_name, SUM(o.quantity * o.unit_price) as total_revenue, SUM(o.quantity) as total_units FROM Orders o JOIN Products p ON o.product_id = p.id GROUP BY p.product_name ORDER BY total_revenue DESC LIMIT 10"
```

### 步骤 3：月度收入趋势

```bash
python /mnt/skills/public/data-analysis/scripts/analyze.py   --files /mnt/user-data/uploads/sales_2024.xlsx   --action query   --sql "SELECT DATE_TRUNC('month', order_date) as month, SUM(quantity * unit_price) as revenue FROM Orders GROUP BY month ORDER BY month"   --output-file /mnt/user-data/outputs/monthly-trends.csv
```

### 步骤 4：统计摘要

```bash
python /mnt/skills/public/data-analysis/scripts/analyze.py   --files /mnt/user-data/uploads/sales_2024.xlsx   --action summary   --table Orders
```

向用户展示结果时，请清晰解释发现、趋势与可执行建议。

## 多文件示例

用户上传 `orders.csv` 和 `customers.xlsx`，并提出："哪个地区的平均订单金额最高？"

```bash
python /mnt/skills/public/data-analysis/scripts/analyze.py   --files /mnt/user-data/uploads/orders.csv /mnt/user-data/uploads/customers.xlsx   --action query   --sql "SELECT c.region, AVG(o.amount) as avg_order_value, COUNT(*) as order_count FROM orders o JOIN Customers c ON o.customer_id = c.id GROUP BY c.region ORDER BY avg_order_value DESC"
```

## 输出处理

分析完成后：

- 在对话中直接以格式化表格展示查询结果
- 大结果集导出到文件，并通过 `present_files` 工具分享
- 始终用通俗语言解释关键结论
- 当发现有价值模式时建议后续分析
- 若用户需要留存结果，主动提供导出

## 缓存

脚本会自动缓存已加载数据，避免每次重新解析：

- 首次加载时，文件会被解析并存入 `/mnt/user-data/workspace/.data-analysis-cache/` 下的持久 DuckDB 数据库
- 缓存键为输入文件内容的 SHA256；文件变化会生成新缓存
- 相同文件的后续调用会直接使用缓存数据库（启动接近瞬时）
- 缓存过程透明，无需额外参数

这对同一数据文件执行多轮操作（inspect → query → summary）尤其高效。

## 备注

- DuckDB 支持完整 SQL：窗口函数、CTE、子查询与高级聚合
- Excel 日期列会自动解析，可使用 DuckDB 日期函数（`DATE_TRUNC`、`EXTRACT` 等）
- 超大文件（100MB+）也可高效处理，无需全部载入内存
- 含空格的列名可用双引号访问：`"Column Name"`
