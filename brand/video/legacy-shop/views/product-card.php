<div class="card">
  <h2><?= $product->label() ?></h2>
  <?php if ($product->hasTag('sale')): ?>
    <span class="badge">On sale</span>
  <?php endif; ?>
</div>
