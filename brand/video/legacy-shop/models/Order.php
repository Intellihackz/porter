<?php
class Order {
    public $items = [];
    public $status = 'pending';

    public function add(Product $product, int $qty = 1) {
        $this->items[] = ['product' => $product, 'qty' => $qty];
    }

    public function count(): int {
        return count($this->items);
    }

    public function summary(): array {
        return [
            'status' => strtoupper($this->status),
            'lines' => count($this->items),
        ];
    }
}
