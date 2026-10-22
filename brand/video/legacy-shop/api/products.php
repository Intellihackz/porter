<?php
$page = intval($_GET['page'] ?? 1);
$products = [
    ['name' => 'Mug', 'price' => 12, 'tags' => ['sale']],
    ['name' => 'Shirt', 'price' => 25, 'tags' => []],
];
$names = array_map(fn($p) => $p['name'], $products);
echo json_encode(['page' => $page, 'items' => $names]);
