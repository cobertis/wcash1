-- Verificar datos de la base de datos

-- 1. Ver todas las cuentas y sus balances
SELECT 
    phone_number,
    member_name,
    current_balance_dollars,
    CAST(current_balance_dollars AS DECIMAL) as balance_numeric
FROM member_history
WHERE member_name IS NOT NULL 
    AND member_name != '' 
    AND member_name != 'null'
    AND member_name != 'undefined'
ORDER BY CAST(current_balance_dollars AS DECIMAL) ASC
LIMIT 50;

-- 2. Contar cuentas por rango de balance
SELECT 
    CASE 
        WHEN CAST(current_balance_dollars AS DECIMAL) >= 100 THEN '$100+'
        WHEN CAST(current_balance_dollars AS DECIMAL) >= 50 THEN '$50-$99.99'
        WHEN CAST(current_balance_dollars AS DECIMAL) >= 20 THEN '$20-$49.99'
        WHEN CAST(current_balance_dollars AS DECIMAL) >= 10 THEN '$10-$19.99'
        WHEN CAST(current_balance_dollars AS DECIMAL) >= 5 THEN '$5-$9.99'
        ELSE '$0-$4.99'
    END as balance_range,
    COUNT(*) as count
FROM member_history
WHERE member_name IS NOT NULL 
    AND member_name != '' 
    AND member_name != 'null'
    AND member_name != 'undefined'
GROUP BY balance_range
ORDER BY 
    CASE balance_range
        WHEN '$100+' THEN 1
        WHEN '$50-$99.99' THEN 2
        WHEN '$20-$49.99' THEN 3
        WHEN '$10-$19.99' THEN 4
        WHEN '$5-$9.99' THEN 5
        WHEN '$0-$4.99' THEN 6
    END;

-- 3. Ver específicamente cuentas con $0-$4.99
SELECT 
    phone_number,
    member_name,
    current_balance_dollars
FROM member_history
WHERE member_name IS NOT NULL 
    AND member_name != '' 
    AND member_name != 'null'
    AND member_name != 'undefined'
    AND CAST(current_balance_dollars AS DECIMAL) >= 0.00
    AND CAST(current_balance_dollars AS DECIMAL) < 5.00
LIMIT 25;
