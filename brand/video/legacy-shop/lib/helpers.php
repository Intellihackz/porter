<?php
function money($amount, $currency = 'USD') {
    return $currency . ' ' . number_format($amount, 2);
}

function slugify(string $title): string {
    $slug = strtolower(trim($title));
    return str_replace(' ', '-', $slug);
}

function cart_total(array $items): float {
    $total = 0;
    foreach ($items as $item) {
        $total += $item['price'] * $item['qty'];
    }
    return round($total * (1 + TAX_RATE), 2);
}
