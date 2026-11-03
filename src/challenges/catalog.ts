import { ChallengeDefinition } from './types';

// Add contributed challenges here. Keep setup data self-contained and solutions result-based.
export const challengeCatalog: ChallengeDefinition[] = [
  {
    id: 'department-sales',
    title: 'Department sales report',
    summary: 'Join orders to departments and aggregate completed sales.',
    prompt: 'Return each department name and its total completed sales. Include only departments with at least two completed orders, sort by total sales from highest to lowest, then by department name. Name the total column `total_sales`.',
    difficulty: 'Beginner',
    topics: ['JOIN', 'GROUP BY', 'HAVING', 'ORDER BY'],
    setupSql: `CREATE TABLE departments (department_id INTEGER, name VARCHAR);
CREATE TABLE orders (order_id INTEGER, department_id INTEGER, amount DECIMAL(10, 2), status VARCHAR);
INSERT INTO departments VALUES (1, 'Books'), (2, 'Games'), (3, 'Music');
INSERT INTO orders VALUES (101, 1, 20.00, 'completed'), (102, 1, 30.00, 'completed'), (103, 1, 90.00, 'cancelled'), (104, 2, 45.00, 'completed'), (105, 2, 15.00, 'completed'), (106, 2, 10.00, 'completed'), (107, 3, 100.00, 'cancelled'), (108, 3, 25.00, 'completed');`,
    starterSql: `SELECT
    d.name,
    SUM(o.amount) AS total_sales
FROM departments d
JOIN orders o ON o.department_id = d.department_id
WHERE o.status = 'completed'
GROUP BY d.name
ORDER BY total_sales DESC, d.name;`,
    solutionSql: `SELECT d.name, SUM(o.amount) AS total_sales
FROM departments d JOIN orders o ON o.department_id = d.department_id
WHERE o.status = 'completed'
GROUP BY d.name HAVING COUNT(*) >= 2
ORDER BY total_sales DESC, d.name;`,
    ordered: true,
    hints: ['Filter out cancelled orders before aggregating.', 'Use HAVING to filter groups by their completed order count.'],
  },
  {
    id: 'customers-without-orders',
    title: 'Customers without orders',
    summary: 'Find customers who have never placed an order, including a NULL trap.',
    prompt: 'Return the IDs and names of customers who have never placed an order. Sort by customer_id. One row in the orders table has a NULL customer_id, so choose a NULL-safe anti-join strategy.',
    difficulty: 'Intermediate',
    topics: ['NULL', 'NOT IN', 'Anti-join'],
    setupSql: `CREATE TABLE customers (customer_id INTEGER, name VARCHAR);
CREATE TABLE orders (order_id INTEGER, customer_id INTEGER);
INSERT INTO customers VALUES (1, 'Ana'), (2, 'Bruno'), (3, 'Caio'), (4, 'Dani');
INSERT INTO orders VALUES (501, 1), (502, 3), (503, NULL);`,
    starterSql: `SELECT customer_id, name
FROM customers
WHERE customer_id NOT IN (SELECT customer_id FROM orders)
ORDER BY customer_id;`,
    solutionSql: `SELECT c.customer_id, c.name
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id
)
ORDER BY c.customer_id;`,
    ordered: true,
    hints: ['What does NOT IN return when its set contains NULL?', 'Consider a correlated NOT EXISTS subquery or a LEFT JOIN with an IS NULL filter.'],
  },
  {
    id: 'products-with-no-sales',
    title: 'Products with no sales',
    summary: 'Preserve unmatched products while counting related sale rows.',
    prompt: 'List every product and the number of sales it has, including products with no sales. Return product name and `sale_count`, ordered by product_id. Be careful where you apply filters after a LEFT JOIN.',
    difficulty: 'Intermediate',
    topics: ['LEFT JOIN', 'COUNT', 'NULL'],
    setupSql: `CREATE TABLE products (product_id INTEGER, name VARCHAR, active BOOLEAN);
CREATE TABLE sales (sale_id INTEGER, product_id INTEGER, sale_date DATE);
INSERT INTO products VALUES (1, 'Keyboard', true), (2, 'Mouse', true), (3, 'Monitor', false);
INSERT INTO sales VALUES (1001, 1, DATE '2026-01-10'), (1002, 1, DATE '2026-02-03'), (1003, 3, DATE '2026-02-14');`,
    starterSql: `SELECT p.name, COUNT(s.sale_id) AS sale_count
FROM products p
LEFT JOIN sales s ON s.product_id = p.product_id
WHERE s.sale_date >= DATE '2026-01-01'
GROUP BY p.product_id, p.name
ORDER BY p.product_id;`,
    solutionSql: `SELECT p.name, COUNT(s.sale_id) AS sale_count
FROM products p
LEFT JOIN sales s ON s.product_id = p.product_id
GROUP BY p.product_id, p.name
ORDER BY p.product_id;`,
    ordered: true,
    hints: ['COUNT(*) counts the preserved product row even when no sale matches.', 'COUNT(s.sale_id) ignores the NULL produced for unmatched rows.', 'A WHERE condition on the right table can remove unmatched rows.'],
  },
];
