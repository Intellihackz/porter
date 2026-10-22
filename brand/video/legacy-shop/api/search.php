<?php
$q = trim($_GET['q'] ?? '');
if (empty($q)) {
    $results = [];
} else {
    $results = array_filter($catalog, fn($p) => str_contains(strtolower($p['name']), strtolower($q)));
}
echo json_encode(array_values($results));
