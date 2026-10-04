// SPDX-License-Identifier: MIT
 pragma solidity >=0.8.30;

/* Compose
 * https://compose.diamonds
 */

import "@perfect-abstractions/compose/diamond/DiamondMod.sol" as DiamondMod;
import "@perfect-abstractions/compose/access/Owner/Data/OwnerDataMod.sol" as OwnerDataMod;
import "@perfect-abstractions/compose/access/Owner/Transfer/OwnerTransferMod.sol" as OwnerTransferMod;
import "@perfect-abstractions/compose/token/ERC20/Metadata/ERC20MetadataMod.sol" as ERC20MetadataMod;
import "@perfect-abstractions/compose/interfaceDetection/ERC165/ERC165Mod.sol" as ERC165Mod;
import "@perfect-abstractions/compose/interfaces/IERC20.sol";
import "@perfect-abstractions/compose/interfaces/IERC173.sol";

contract Diamond {
    constructor(address[] memory _facets) {
        DiamondMod.addFacets(_facets);
        
        OwnerDataMod.setContractOwner(msg.sender);
        ERC20MetadataMod.setMetadata({_name: "ExampleToken", _symbol: "EXT", _decimals: 18});
        ERC165Mod.registerInterface(type(IERC20).interfaceId);
        ERC165Mod.registerInterface(type(IERC173).interfaceId);
    }

    fallback() external payable {
        DiamondMod.diamondFallback();
    }

    receive() external payable {}
}