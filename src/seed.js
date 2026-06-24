export const mkSeed = () => ({
  activeVoyageId: "v1",
  voyages: [
    {
      id: "v1",
      vessel: "MV APJ Karan 2",
      voyageNo: "AK2-118",
      date: new Date().toLocaleDateString("en-CA"),
      containers: [
        {
          id: "c1",
          number: "APZU2231140",
          size: "20",
          capacityBags: 340,
          sealNo: "SL22F34",
          sealed: true,
          lines: [
            {
              id: "l1",
              cargo: "Potato",
              qty: 340,
              unitWeightKg: 50,
              shipper: "Shafrina Impex LLP",
              consignee: "Y.E. Jadwet Group",
              truckNo: "WB23F4471",
            },
          ],
        },
        {
          id: "c2",
          number: "TGHU5567021",
          size: "20",
          capacityBags: 340,
          sealNo: "",
          sealed: false,
          lines: [
            {
              id: "l2",
              cargo: "Potato",
              qty: 180,
              unitWeightKg: 50,
              shipper: "Shafrina Impex LLP",
              consignee: "Y.E. Jadwet Group",
              truckNo: "WB25E2210",
            },
            {
              id: "l3",
              cargo: "Potato",
              qty: 100,
              unitWeightKg: 50,
              shipper: "Shafrina Impex LLP",
              consignee: "Y.E. Jadwet Group",
              truckNo: "WB18C3301",
            },
          ],
        },
        {
          id: "c3",
          number: "",
          size: "20",
          capacityBags: 340,
          sealNo: "",
          sealed: false,
          lines: [],
        },
      ],
    },
  ],
});
