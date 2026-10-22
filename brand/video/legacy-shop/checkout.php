<?php
$items = $_SESSION['cart'] ?? [];
$total = cart_total($items);
echo "Charging " . money($total);
