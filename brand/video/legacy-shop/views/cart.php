<ul class="cart">
<?php foreach ($items as $item): ?>
  <li><?= $item['name'] ?> x <?= $item['qty'] ?></li>
<?php endforeach; ?>
</ul>
<p>Total: <?= money(cart_total($items)) ?></p>
