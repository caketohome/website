import { MenuActions } from "@frontend/components/dashboard/menu/menu-actions";
import { MenuProductActions } from "@frontend/components/dashboard/menu/menu-product-actions";
import { retrieveUser } from "@frontend/lib/data";
import { BranchRepository } from "@frontend/lib/repositories/branch.repository";
import { ApiEngine } from "@frontend/lib/api-engine";
import { ShopManagerDTO, ProductDTO, ProductVariantDTO, ShopDTO } from "@frontend/lib/types";
import { Heading, Table, Text } from "@medusajs/ui";
import Image from "next/image";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const user = (await retrieveUser()) as ShopManagerDTO;
  if (!user || (user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) {
    redirect("/login");
  }

  const shopId = user?.shop_id || user?.branch_id || "";
  const branch = await BranchRepository.findById(shopId);
  const categories = ApiEngine.getCategories();
  const branchProds = ApiEngine.getBranchProducts(branch?.id || shopId);

  const shop: ShopDTO = {
    id: branch?.id || shopId,
    name: branch?.name || "CakeToHome Bakery Hub",
    description: "Bakery Branch & Fulfillment Center",
    handle: branch?.code?.toLowerCase() || "caketohome",
    is_open: branch?.is_open !== false,
    address: branch?.address || "Bakery Hub",
    phone: branch?.phone || "",
    email: branch?.email || "",
    deliveries: [],
    products: (branchProds.products || []).map((p: any) => ({
      id: p.id,
      title: p.title || p.name,
      description: p.description || "Gourmet cake made fresh daily",
      thumbnail: p.thumbnail,
      categories: [{ id: p.category_id || "cat_bestseller", name: p.category || "Gourmet Cakes" }],
      variants: [
        {
          id: `var_${p.id}`,
          title: "1 kg",
          sku: `SKU_${p.id}`,
          price: { calculated_amount: String(p.price || p.selling_price || 599) },
        },
      ],
    })),
  } as any;


  const categoryProductMap = new Map();

  shop?.products?.forEach((product: any) => {
    if (product.categories) {
      product.categories.forEach((category: any) => {
        if (categoryProductMap.has(category.id)) {
          categoryProductMap.get(category.id).products.push(product);
        } else {
          categoryProductMap.set(category.id, {
            category_name: category.name,
            products: [product],
          });
        }
      });
    }
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Heading level="h1" className="text-2xl">
            {shop.name} | Product Dashboard
          </Heading>
          <Text>View and manage your bakery&apos;s products</Text>
        </div>
        <MenuActions shop={shop} categories={categories} />
      </div>
      {Array.from(categoryProductMap).map(([categoryId, category]) => (
        <div key={categoryId} className="flex flex-col gap-4">
          <Heading level="h2" className="text-xl">
            {category.category_name}
          </Heading>
          <Table className="table-fixed">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Thumbnail</Table.HeaderCell>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Description</Table.HeaderCell>
                <Table.HeaderCell>Price</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {category.products?.map((product: ProductDTO) => {
                const variants = product.variants as (ProductVariantDTO & {
                  price_set: any;
                  price: any;
                })[];
                const thumbnail = product.thumbnail;

                return (
                  <Table.Row key={product.id}>
                    <Table.Cell>
                      {thumbnail && (
                        <Image
                          src={thumbnail!}
                          className="h-12 w-12 rounded-md m-2"
                          width={48}
                          height={48}
                          alt={`Thumbnail for ${product.title}`}
                        />
                      )}
                    </Table.Cell>
                    <Table.Cell>{product.title}</Table.Cell>
                    <Table.Cell>{product.description}</Table.Cell>
                    <Table.Cell>
                      ₹{variants[0].price?.calculated_amount || 599}
                    </Table.Cell>
                    <Table.Cell>
                      <MenuProductActions
                        product={product}
                        shop={shop}
                      />
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      ))}
    </div>
  );
}
