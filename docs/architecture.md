# Architecture — C4 Container Diagram

Use-case: **Place & Pay for Order**

```mermaid
flowchart TD
    Browser(["👤 Browser / User"])

    subgraph Frontend ["Frontend  —  :3000  (Create React App)"]
        direction TB
        App["frontend/src/App.js\n(React Router v5)"]

        subgraph Screens ["Screens"]
            CartScreen["screens/CartScreen.js"]
            PlaceOrderScreen["screens/PlaceOrderScreen.js"]
            PaymentScreen["screens/PaymentScreen.js"]
            OrderScreen["screens/OrderScreen.js"]
        end

        subgraph Redux ["Redux Layer"]
            Store["store.js\n(localStorage hydration)"]
            CartActions["actions/cartActions.js"]
            OrderActions["actions/orderActions.js"]
            OrderReducers["reducers/orderReducers.js"]
        end
    end

    subgraph Backend ["Backend  —  :5000  (Express)"]
        direction TB
        Server["backend/server.js\n(entry point, static serve)"]

        subgraph Middleware ["Middleware"]
            AuthMW["middleware/authMiddleware.js\n(protect / admin)"]
            ErrorMW["middleware/errorMiddleware.js"]
        end

        subgraph Routes ["Routes"]
            OrderRoutes["routes/orderRoutes.js\nPOST / · GET /\nGET /:id · PUT /:id/pay\nPUT /:id/deliver"]
            UserRoutes["routes/userRoutes.js"]
            ProductRoutes["routes/productRoutes.js"]
            UploadRoutes["routes/uploadRoutes.js\n(multer · /uploads/)"]
            PaypalConfig["GET /api/config/paypal\n(inline in server.js)"]
        end

        subgraph Controllers ["Controllers"]
            OrderCtrl["controllers/orderController.js\naddOrderItems · getOrderById\nupdateOrderToPaid · updateOrderToDelivered\ngetMyOrders · getOrders"]
            UserCtrl["controllers/userController.js\nauthUser · registerUser\ngetUserProfile · updateUserProfile"]
            ProductCtrl["controllers/productController.js\ngetProducts · getProductById\ncreateProduct · updateProduct\ndeleteProduct · createProductReview"]
        end

        subgraph Models ["Mongoose Models"]
            OrderModel["models/orderModel.js"]
            UserModel["models/userModel.js"]
            ProductModel["models/productModel.js"]
        end

        subgraph Utils ["Utils"]
            GenToken["utils/generateToken.js\n(JWT sign)"]
        end

        Seeder["backend/seeder.js\n(CLI seed / destroy)"]
    end

    subgraph DataLayer ["Data Layer"]
        MongoDB[("MongoDB Atlas\nMONGO_URI")]
        LocalFS[("Local FS\n/uploads/\n(image files)")]
    end

    subgraph External ["External Services"]
        PayPalSDK["PayPal JS SDK\npaypal.com/sdk/js"]
        PayPalAPI["PayPal REST API\n(payment capture)"]
    end

    %% ── Use-case: Place & Pay for Order ──────────────────────────
    Browser -->|"1 · add to cart"| CartScreen
    CartScreen --> CartActions
    CartActions --> Store

    Store -->|"2 · cart state"| PlaceOrderScreen
    PlaceOrderScreen --> PaymentScreen
    PaymentScreen -->|"3 · POST /api/orders\nBearer JWT"| OrderActions
    OrderActions -->|"axios POST"| Server

    Server --> AuthMW
    AuthMW --> OrderRoutes
    OrderRoutes --> OrderCtrl
    OrderCtrl --> OrderModel
    OrderModel --> MongoDB

    MongoDB -->|"saved order"| OrderCtrl
    OrderCtrl -->|"order JSON"| OrderScreen

    OrderScreen -->|"4 · GET /api/config/paypal"| PaypalConfig
    PaypalConfig -->|"PAYPAL_CLIENT_ID"| OrderScreen
    OrderScreen -->|"5 · load SDK"| PayPalSDK

    PayPalSDK -->|"6 · payment approved\npaymentResult"| OrderScreen
    OrderScreen -->|"7 · PUT /api/orders/:id/pay\nBearer JWT"| OrderActions
    OrderActions -->|"axios PUT"| Server
    Server --> AuthMW
    AuthMW --> OrderRoutes
    OrderRoutes --> OrderCtrl
    OrderCtrl -->|"mark isPaid=true"| OrderModel
    OrderModel --> MongoDB

    %% ── Other flows (auxiliary) ──────────────────────────────────
    UploadRoutes -->|"save file"| LocalFS
    UserCtrl --> GenToken
    UserCtrl --> UserModel
    UserModel --> MongoDB
    ProductCtrl --> ProductModel
    ProductModel --> MongoDB

    Seeder -.->|"seed / destroy"| MongoDB

    %% ── Styles ──────────────────────────────────────────────────
    style Frontend fill:#dbeafe,stroke:#3b82f6
    style Backend fill:#dcfce7,stroke:#22c55e
    style DataLayer fill:#fef9c3,stroke:#eab308
    style External fill:#fce7f3,stroke:#ec4899
```

## Flow steps

| # | Step |
|---|------|
| 1 | User adds items to cart — `cartActions` persists to `localStorage` via Redux |
| 2 | `PlaceOrderScreen` reads cart state from Redux store |
| 3 | `POST /api/orders` with `Bearer JWT` — order saved to MongoDB |
| 4 | `OrderScreen` fetches `PAYPAL_CLIENT_ID` from `/api/config/paypal` |
| 5 | Browser loads PayPal JS SDK dynamically |
| 6 | After user approves payment, PayPal returns `paymentResult` |
| 7 | `PUT /api/orders/:id/pay` — sets `isPaid=true` and `paidAt` in MongoDB |

> Dashed line — `backend/seeder.js` is a CLI tool, not an HTTP path.
