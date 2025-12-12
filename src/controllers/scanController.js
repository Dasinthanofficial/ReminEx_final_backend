import axios from "axios";


export const scanProductByBarcode = async (req, res) => {
  try {
    const code = req.params.code;
    const url = `https://world.openfoodfacts.org/api/v0/product/${code}.json`;

    const { data } = await axios.get(url);

    if (data.status !== 1 || !data.product) {
      return res
        .status(404)
        .json({ message: "Product not found in Open Food Facts" });
    }

    const p = data.product;

    const productInfo = {
      barcode: code,
      name: p.product_name || "",
      brand: p.brands || "",
      quantity: p.quantity || "", 
      category: "Food",
      image: p.image_url || "",
    
    };

    res.json(productInfo);
  } catch (err) {
    console.error("Scan barcode error:", err.message);
    res.status(500).json({ message: "Failed to scan product" });
  }
};